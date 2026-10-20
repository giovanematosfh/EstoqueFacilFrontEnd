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

// Planilha montada célula a célula (cabeçalho em dois níveis, células mescladas).
export interface GridSheet {
  name: string;
  rows: (string | number)[][];
  merges?: XLSX.Range[];
  columnWidths?: number[];
}

export interface ReportSheet {
  name: string;
  data: object[];
  columns: ReportColumn<any>[];
}

function gridToWorksheet(sheet: GridSheet): XLSX.WorkSheet {
  const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
  worksheet['!merges'] = sheet.merges ?? [];
  if (sheet.columnWidths) {
    worksheet['!cols'] = sheet.columnWidths.map((wch) => ({ wch }));
  }
  return worksheet;
}

export function exportGridToExcel(sheet: GridSheet, filename: string): void {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, gridToWorksheet(sheet), sheet.name.slice(0, 31));
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

// Várias abas num único arquivo .xlsx (nome da aba: até 31 caracteres).
export function exportSheetsToExcel(sheets: (ReportSheet | GridSheet)[], filename: string): void {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    if ('rows' in sheet) {
      XLSX.utils.book_append_sheet(workbook, gridToWorksheet(sheet), sheet.name.slice(0, 31));
      continue;
    }

    const rows = sheet.data.map((row) => {
      const record: Record<string, string> = {};
      for (const column of sheet.columns) {
        record[column.header] = formatCell(row, column);
      }
      return record;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows, { header: sheet.columns.map((c) => c.header) });
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  }

  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

// PDF em paisagem com cabeçalho livre (permite colSpan/rowSpan do autoTable).
export function exportGridToPdf(
  head: (string | object)[][],
  body: (string | number)[][],
  filename: string,
  title: string,
): void {
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(14);
  doc.text(title, 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 21);

  autoTable(doc, {
    head: head as any,
    body,
    startY: 26,
    styles: { fontSize: 7, halign: 'center' },
    headStyles: { fillColor: [31, 56, 100], halign: 'center', valign: 'middle' },
  });

  doc.save(`${filename}.pdf`);
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
