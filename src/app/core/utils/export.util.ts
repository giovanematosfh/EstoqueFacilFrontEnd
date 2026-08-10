import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ReportColumn<T> {
  header: string;
  key: keyof T;
  format?: (value: T[keyof T], row: T) => string;
}

function formatCell<T>(row: T, column: ReportColumn<T>): string {
  const value = row[column.key];
  if (column.format) {
    return column.format(value, row);
  }
  return value === null || value === undefined ? '' : String(value);
}

export function exportToExcel<T>(data: T[], columns: ReportColumn<T>[], filename: string): void {
  const rows = data.map((row) => {
    const record: Record<string, string> = {};
    for (const column of columns) {
      record[column.header] = formatCell(row, column);
    }
    return record;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export function exportToPdf<T>(
  data: T[],
  columns: ReportColumn<T>[],
  filename: string,
  title: string,
): void {
  const doc = new jsPDF();

  doc.setFontSize(14);
  doc.text(title, 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 21);

  autoTable(doc, {
    head: [columns.map((column) => column.header)],
    body: data.map((row) => columns.map((column) => formatCell(row, column))),
    startY: 26,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [22, 163, 74] },
  });

  doc.save(`${filename}.pdf`);
}
