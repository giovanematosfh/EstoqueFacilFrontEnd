import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PurchaseRequest } from '../models/purchase-request.model';

const GREEN: [number, number, number] = [21, 128, 61];
const MUTED: [number, number, number] = [100, 116, 139];
const TEXT: [number, number, number] = [30, 41, 59];

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
// Datas da API vêm como yyyy-MM-dd; formata sem passar por Date para não sofrer com fuso.
const date = (value?: string | null) => (value ? value.substring(0, 10).split('-').reverse().join('/') : '—');

// Gera a ordem de compra da SC em PDF (A4), pronta para imprimir ou enviar ao fornecedor.
export function downloadPurchaseOrderPdf(order: PurchaseRequest, companyName: string): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Cabeçalho
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('ORDEM DE COMPRA', margin, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${companyName} · ${order.branchName}`, margin, 21);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`Nº ${order.number}`, pageWidth - margin, 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Emitida em ${date(order.requestDate)}`, pageWidth - margin, 21, { align: 'right' });

  // Fornecedor e dados da compra, lado a lado
  const boxTop = 36;
  const boxWidth = (contentWidth - 6) / 2;
  const supplier = order.supplier;
  const supplierLines = supplier
    ? [
        supplier.name,
        supplier.document ? `CNPJ/CPF: ${supplier.document}` : '',
        supplier.phone ? `Telefone: ${supplier.phone}` : '',
        supplier.email ? `E-mail: ${supplier.email}` : '',
        supplier.address ?? '',
      ].filter(Boolean)
    : ['Fornecedor não informado'];
  const orderLines = [
    `Setor: ${order.sectorName ?? '—'}`,
    `Solicitante: ${order.requesterName ?? '—'}`,
    `Previsão de entrega: ${date(order.expectedDeliveryDate)}`,
    `Condição de pagamento: ${order.paymentTerms ?? '—'}`,
  ];

  const drawBox = (x: number, title: string, lines: string[]) => {
    const wrapped = lines.flatMap((line) => doc.splitTextToSize(line, boxWidth - 8) as string[]);
    const height = 12 + wrapped.length * 5;
    doc.setDrawColor(226, 232, 229);
    doc.roundedRect(x, boxTop, boxWidth, height, 2, 2);
    doc.setTextColor(...GREEN);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(title, x + 4, boxTop + 6);
    doc.setTextColor(...TEXT);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    wrapped.forEach((line, i) => doc.text(line, x + 4, boxTop + 12 + i * 5));
    return height;
  };

  const boxHeight = Math.max(
    drawBox(margin, 'FORNECEDOR', supplierLines),
    drawBox(margin + boxWidth + 6, 'DADOS DA COMPRA', orderLines),
  );

  // Itens
  const items = order.items.filter((item) => item.status !== 'Canceled');
  autoTable(doc, {
    startY: boxTop + boxHeight + 8,
    margin: { left: margin, right: margin },
    head: [['#', 'Produto', 'SKU', 'Qtd', 'Preço unit.', 'Total']],
    body: items.map((item, index) => [
      String(index + 1),
      item.productName,
      item.sku,
      String(item.quantity),
      item.unitPrice != null ? money(item.unitPrice) : '—',
      item.total != null ? money(item.total) : '—',
    ]),
    foot: [['', '', '', '', 'Total', money(items.reduce((sum, item) => sum + (item.total ?? 0), 0))]],
    styles: { fontSize: 9.5, textColor: TEXT, cellPadding: 2.5 },
    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [240, 253, 244], textColor: TEXT, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 249] },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      2: { cellWidth: 30 },
      3: { cellWidth: 16, halign: 'right' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 30, halign: 'right' },
    },
  });

  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  const pageHeight = doc.internal.pageSize.getHeight();

  if (items.some((item) => item.unitPrice == null)) {
    doc.setTextColor(...MUTED);
    doc.setFontSize(8.5);
    doc.text('Itens sem preço (—) aguardam cotação e não entram no total.', margin, y);
    y += 6;
  }

  if (order.notes) {
    const notes = doc.splitTextToSize(order.notes, contentWidth) as string[];
    doc.setTextColor(...GREEN);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('OBSERVAÇÕES', margin, y);
    doc.setTextColor(...TEXT);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(notes, margin, y + 5);
    y += 8 + notes.length * 5;
  }

  // Assinaturas (vão para uma nova página se não couberem)
  if (y > pageHeight - 45) {
    doc.addPage();
    y = 30;
  }
  const signY = Math.max(y + 20, pageHeight - 40);
  const signWidth = (contentWidth - 20) / 3;
  ['Solicitante', 'Aprovado por', 'Fornecedor'].forEach((label, i) => {
    const x = margin + i * (signWidth + 10);
    doc.setDrawColor(...MUTED);
    doc.line(x, signY, x + signWidth, signY);
    doc.setTextColor(...MUTED);
    doc.setFontSize(9);
    doc.text(label, x + signWidth / 2, signY + 5, { align: 'center' });
  });

  // Rodapé em todas as páginas
  const generatedAt = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setTextColor(...MUTED);
    doc.setFontSize(8);
    doc.text(`Gerado pelo Estoque Fácil em ${generatedAt}`, margin, pageHeight - 8);
    doc.text(`Página ${page} de ${pages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  doc.save(`ordem-de-compra-${order.number.replace(/[^\w-]+/g, '_')}.pdf`);
}
