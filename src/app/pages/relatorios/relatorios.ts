import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { BranchService } from '../../core/services/branch.service';
import { ProductStockService } from '../../core/services/product-stock.service';
import { PurchaseRequestService } from '../../core/services/purchase-request.service';
import { StockMovementService } from '../../core/services/stock-movement.service';
import { Branch } from '../../core/models/branch.model';
import { ProductStock } from '../../core/models/product-stock.model';
import { PurchaseRequestLine } from '../../core/models/purchase-request.model';
import { StockMovement } from '../../core/models/stock-movement.model';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';
import type { Range } from 'xlsx';
import {
  GridSheet,
  ReportColumn,
  exportGridToExcel,
  exportGridToPdf,
  exportSheetsToExcel,
  exportToExcel,
  exportToPdf,
} from '../../core/utils/export.util';

type ReportType = 'control' | 'summary' | 'lowStock' | 'inventory' | 'movements' | 'purchases';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

interface ReportMonth {
  key: string; // yyyy-MM
  label: string;
}

// Layout da planilha de controle: por unidade e item, utilizado (saídas) e SCs mês a mês.
interface ControlRow {
  key: string;
  branchName: string;
  branchRowSpan: number; // > 0 só na primeira linha de cada unidade
  productName: string;
  minimumQuantity: number;
  used: number[];
  quantity: number;
  missing: number;
  status: 'REPOR' | 'OK';
  requests: string[];
}

// Uma linha por produto em cada filial: entradas/saídas do período + situação atual.
interface SummaryRow {
  key: string;
  productName: string;
  sku: string;
  branchName: string;
  inbound: number;
  outbound: number;
  quantity: number;
  minimumQuantity: number;
  missing: number;
  lowStock: boolean;
  openRequest: string;
}

const STATUS_LABELS: Record<PurchaseRequestLine['status'], string> = {
  Open: 'Aberta',
  Received: 'Recebida',
  Canceled: 'Cancelada',
};

const SUMMARY_COLUMNS: ReportColumn<SummaryRow>[] = [
  { header: 'Produto', key: 'productName' },
  { header: 'SKU', key: 'sku' },
  { header: 'Filial', key: 'branchName' },
  { header: 'Entradas', key: 'inbound' },
  { header: 'Saídas', key: 'outbound' },
  { header: 'Estoque atual', key: 'quantity' },
  { header: 'Mínimo', key: 'minimumQuantity' },
  { header: 'Qtd a solicitar', key: 'missing' },
  { header: 'Status', key: 'lowStock', format: (v) => (v ? 'Baixo' : 'OK') },
  { header: 'SC em aberto', key: 'openRequest' },
];

const PRODUCT_STOCK_COLUMNS: ReportColumn<ProductStock>[] = [
  { header: 'Nome', key: 'productName' },
  { header: 'SKU', key: 'sku' },
  { header: 'Filial', key: 'branchName' },
  { header: 'Quantidade', key: 'quantity' },
  { header: 'Mínimo', key: 'minimumQuantity' },
  { header: 'SC em aberto', key: 'purchaseRequestNumber' },
];

const MOVEMENT_COLUMNS: ReportColumn<StockMovement>[] = [
  { header: 'Produto', key: 'productName' },
  { header: 'Filial', key: 'branchName' },
  { header: 'Tipo', key: 'type', format: (v) => (v === 'Inbound' ? 'Entrada' : 'Saída') },
  { header: 'Quantidade', key: 'quantity' },
  { header: 'Motivo', key: 'reason' },
  { header: 'Solicitante', key: 'requesterName' },
  { header: 'Setor', key: 'sector' },
  { header: 'Data', key: 'movementDate', format: (v) => formatDateTime(v as string) },
];

const PURCHASE_COLUMNS: ReportColumn<PurchaseRequestLine>[] = [
  { header: 'Nº SC', key: 'number' },
  { header: 'Produto', key: 'productName' },
  { header: 'Filial', key: 'branchName' },
  { header: 'Quantidade', key: 'quantity' },
  { header: 'Data da SC', key: 'requestDate', format: (v) => formatDate(v as string) },
  { header: 'Status', key: 'status', format: (v) => STATUS_LABELS[v as PurchaseRequestLine['status']] },
  { header: 'Recebida em', key: 'receivedDate', format: (v) => formatDate(v as string) },
  { header: 'Qtd recebida', key: 'receivedQuantity' },
  { header: 'Solicitante', key: 'requesterName' },
];

function formatDateTime(value: string): string {
  return value ? new Date(value).toLocaleString('pt-BR') : '';
}

// yyyy-MM-dd -> dd/MM/yyyy sem passar por Date (evita deslocamento de fuso).
function formatDate(value: string | null | undefined): string {
  return value ? value.split('-').reverse().join('/') : '';
}

// Meses entre duas datas yyyy-MM-dd (inclusive). Mostra o ano no rótulo quando o período cruza anos.
function monthsBetween(from: string, to: string): ReportMonth[] {
  let year = Number(from.substring(0, 4));
  let month = Number(from.substring(5, 7));
  const endYear = Number(to.substring(0, 4));
  const endMonth = Number(to.substring(5, 7));
  const showYear = year !== endYear;

  const months: ReportMonth[] = [];
  while ((year < endYear || (year === endYear && month <= endMonth)) && months.length < 24) {
    const name = MONTH_NAMES[month - 1];
    months.push({
      key: `${year}-${String(month).padStart(2, '0')}`,
      label: showYear ? `${name.substring(0, 3)}/${String(year).substring(2)}` : name,
    });
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return months;
}

function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

@Component({
  selector: 'app-relatorios',
  imports: [ReactiveFormsModule, FormsModule, DatePipe, EmptyState, Icon],
  templateUrl: './relatorios.html',
  styleUrl: './relatorios.css',
})
export class Relatorios implements OnInit {
  private readonly branchService = inject(BranchService);
  private readonly productStockService = inject(ProductStockService);
  private readonly stockMovementService = inject(StockMovementService);
  private readonly purchaseRequestService = inject(PurchaseRequestService);
  private readonly fb = inject(FormBuilder);

  protected readonly STATUS_LABELS = STATUS_LABELS;
  protected readonly formatDate = formatDate;

  protected readonly branches = signal<Branch[]>([]);
  // null = todas as filiais
  protected readonly selectedBranchId = signal<number | null>(null);

  protected readonly activeReport = signal<ReportType>('control');
  protected readonly loading = signal(false);
  protected readonly loadError = signal('');

  protected readonly inventoryItems = signal<ProductStock[]>([]);
  protected readonly movements = signal<StockMovement[]>([]);
  protected readonly purchaseRequests = signal<PurchaseRequestLine[]>([]);

  protected readonly lowStockItems = computed(() => this.inventoryItems().filter((item) => item.lowStock));
  protected readonly summaryRows = computed(() => this.buildSummary(this.inventoryItems(), this.movements()));
  protected readonly totals = computed(() => {
    const rows = this.summaryRows();
    return {
      inbound: rows.reduce((sum, row) => sum + row.inbound, 0),
      outbound: rows.reduce((sum, row) => sum + row.outbound, 0),
      lowStock: rows.filter((row) => row.lowStock).length,
      // SCs distintas com item pendente (cada linha é um item).
      openRequests: new Set(this.purchaseRequests().filter((pr) => pr.status === 'Open').map((pr) => pr.purchaseRequestId)).size,
    };
  });

  // Padrão: os últimos 5 meses, como na planilha de controle.
  protected readonly dateForm = this.fb.nonNullable.group({
    from: [isoDate(new Date(new Date().getFullYear(), new Date().getMonth() - 4, 1))],
    to: [isoDate(new Date())],
  });

  // Meses do período gerado (fixados no Gerar, para a tabela não mudar enquanto edita as datas).
  protected readonly months = signal<ReportMonth[]>([]);
  protected readonly controlRows = computed(() =>
    this.buildControl(this.inventoryItems(), this.movements(), this.purchaseRequests(), this.months()),
  );
  protected readonly controlTotalMissing = computed(() =>
    this.controlRows().reduce((sum, row) => sum + row.missing, 0),
  );

  ngOnInit(): void {
    this.loadBranches();
  }

  protected onBranchChange(branchId: number | null): void {
    this.selectedBranchId.set(branchId);
    this.generate();
  }

  protected selectReport(type: ReportType): void {
    this.activeReport.set(type);
  }

  protected scopeLabel(): string {
    const branchId = this.selectedBranchId();
    return branchId ? (this.branches().find((b) => b.id === branchId)?.name ?? '') : 'Todas as filiais';
  }

  protected hasData(): boolean {
    switch (this.activeReport()) {
      case 'control':
        return this.controlRows().length > 0;
      case 'summary':
        return this.summaryRows().length > 0;
      case 'lowStock':
        return this.lowStockItems().length > 0;
      case 'inventory':
        return this.inventoryItems().length > 0;
      case 'movements':
        return this.movements().length > 0;
      case 'purchases':
        return this.purchaseRequests().length > 0;
    }
  }

  // Busca tudo de uma vez: saldos (todas as filiais ou uma), movimentações e SCs do período.
  protected generate(): void {
    const { from, to } = this.dateForm.getRawValue();
    const branchId = this.selectedBranchId();

    this.loading.set(true);
    this.loadError.set('');

    forkJoin({
      inventory: this.productStockService.getReport(branchId),
      movements: this.stockMovementService.getReport(`${from}T00:00:00`, `${to}T23:59:59`, branchId ?? undefined),
      purchases: this.purchaseRequestService.getReport(branchId, from, to),
    }).subscribe({
      next: ({ inventory, movements, purchases }) => {
        this.months.set(monthsBetween(from, to));
        this.inventoryItems.set(inventory);
        this.movements.set(movements);
        this.purchaseRequests.set(purchases);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set('Não foi possível gerar os relatórios. Tente novamente.');
      },
    });
  }

  protected exportAll(): void {
    exportSheetsToExcel(
      [
        this.controlSheet(),
        { name: 'Resumo por produto', data: this.summaryRows(), columns: SUMMARY_COLUMNS },
        { name: 'Estoque baixo', data: this.lowStockItems(), columns: PRODUCT_STOCK_COLUMNS },
        { name: 'Estoque atual', data: this.inventoryItems(), columns: PRODUCT_STOCK_COLUMNS },
        { name: 'Movimentações', data: this.movements(), columns: MOVEMENT_COLUMNS },
        { name: 'Solicitações de compra', data: this.purchaseRequests(), columns: PURCHASE_COLUMNS },
      ],
      this.fileName('relatorio-completo'),
    );
  }

  protected exportExcel(): void {
    switch (this.activeReport()) {
      case 'control':
        exportGridToExcel(this.controlSheet(), this.fileName('controle-estoque'));
        break;
      case 'summary':
        exportToExcel(this.summaryRows(), SUMMARY_COLUMNS, this.fileName('resumo-por-produto'));
        break;
      case 'lowStock':
        exportToExcel(this.lowStockItems(), PRODUCT_STOCK_COLUMNS, this.fileName('estoque-baixo'));
        break;
      case 'inventory':
        exportToExcel(this.inventoryItems(), PRODUCT_STOCK_COLUMNS, this.fileName('estoque-geral'));
        break;
      case 'movements':
        exportToExcel(this.movements(), MOVEMENT_COLUMNS, this.fileName('movimentacoes'));
        break;
      case 'purchases':
        exportToExcel(this.purchaseRequests(), PURCHASE_COLUMNS, this.fileName('solicitacoes-compra'));
        break;
    }
  }

  protected exportPdf(): void {
    const scope = this.scopeLabel();
    const { from, to } = this.dateForm.getRawValue();
    const period = `${formatDate(from)} a ${formatDate(to)}`;

    switch (this.activeReport()) {
      case 'control': {
        const months = this.months();
        const fixed = (content: string) => ({ content, rowSpan: 2 });
        const head = [
          [
            fixed('UNIDADE'), fixed('ITEM'), fixed('ESTOQUE SEGURANÇA'),
            { content: 'UTILIZADO', colSpan: months.length },
            fixed('ESTOQUE ATUAL'), fixed('QTD A SOLICITAR'), fixed('STATUS'),
            { content: 'SC - SOLICITAÇÃO DE COMPRAS', colSpan: months.length },
          ],
          [...months.map((m) => m.label), ...months.map((m) => m.label)],
        ];
        const body = this.controlRows().map((row) => this.controlCells(row));
        body.push(['TOTAL GERAL', '', '', ...months.map(() => ''), '', this.controlTotalMissing(), '', ...months.map(() => '')]);
        exportGridToPdf(head, body, this.fileName('controle-estoque'), `Controle de Estoque — ${scope} — ${period}`);
        break;
      }
      case 'summary':
        exportToPdf(this.summaryRows(), SUMMARY_COLUMNS, this.fileName('resumo-por-produto'), `Resumo por Produto — ${scope} — ${period}`);
        break;
      case 'lowStock':
        exportToPdf(this.lowStockItems(), PRODUCT_STOCK_COLUMNS, this.fileName('estoque-baixo'), `Estoque Baixo — ${scope}`);
        break;
      case 'inventory':
        exportToPdf(this.inventoryItems(), PRODUCT_STOCK_COLUMNS, this.fileName('estoque-geral'), `Estoque Atual — ${scope}`);
        break;
      case 'movements':
        exportToPdf(this.movements(), MOVEMENT_COLUMNS, this.fileName('movimentacoes'), `Movimentações — ${scope} — ${period}`);
        break;
      case 'purchases':
        exportToPdf(this.purchaseRequests(), PURCHASE_COLUMNS, this.fileName('solicitacoes-compra'), `Solicitações de Compra — ${scope} — ${period}`);
        break;
    }
  }

  private fileName(base: string): string {
    const scope = this.selectedBranchId() ? this.scopeLabel() : 'todas-filiais';
    const slug = scope
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    return `${base}-${slug}`;
  }

  private controlCells(row: ControlRow): (string | number)[] {
    return [
      row.branchName,
      row.productName,
      row.minimumQuantity,
      ...row.used.map((value) => value || ''),
      row.quantity,
      row.missing,
      row.status,
      ...row.requests,
    ];
  }

  // Mesmo layout da planilha: 2 linhas de cabeçalho, grupos mesclados e UNIDADE mesclada por filial.
  private controlSheet(): GridSheet {
    const months = this.months();
    const n = months.length;
    const usedStart = 3;
    const afterUsed = usedStart + n; // ESTOQUE ATUAL
    const scStart = afterUsed + 3;

    const header1: (string | number)[] = [
      'UNIDADE', 'ITEM', 'ESTOQUE SEGURANÇA',
      'UTILIZADO', ...Array(Math.max(n - 1, 0)).fill(''),
      'ESTOQUE ATUAL', 'QTD A SOLICITAR', 'STATUS',
      'SC - SOLICITAÇÃO DE COMPRAS', ...Array(Math.max(n - 1, 0)).fill(''),
    ];
    const header2: (string | number)[] = [
      '', '', '', ...months.map((m) => m.label), '', '', '', ...months.map((m) => m.label),
    ];

    const merges: Range[] = [];
    const span = (r1: number, c1: number, r2: number, c2: number) => {
      if (r1 !== r2 || c1 !== c2) {
        merges.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
      }
    };
    [0, 1, 2, afterUsed, afterUsed + 1, afterUsed + 2].forEach((c) => span(0, c, 1, c));
    if (n > 0) {
      span(0, usedStart, 0, usedStart + n - 1);
      span(0, scStart, 0, scStart + n - 1);
    }

    const rows = this.controlRows();
    rows.forEach((row, index) => {
      if (row.branchRowSpan > 1) {
        span(2 + index, 0, 2 + index + row.branchRowSpan - 1, 0);
      }
    });

    const body = rows.map((row) => this.controlCells(row));
    const totalRow: (string | number)[] = Array(scStart + n).fill('');
    totalRow[0] = 'TOTAL GERAL';
    totalRow[afterUsed + 1] = this.controlTotalMissing();

    return {
      name: 'Controle de estoque',
      rows: [header1, header2, ...body, totalRow],
      merges,
      columnWidths: [16, 32, 12, ...months.map(() => 11), 12, 12, 9, ...months.map(() => 14)],
    };
  }

  private buildControl(
    inventory: ProductStock[],
    movements: StockMovement[],
    purchases: PurchaseRequestLine[],
    months: ReportMonth[],
  ): ControlRow[] {
    const monthIndex = new Map(months.map((m, i) => [m.key, i]));

    const used = new Map<string, number[]>();
    for (const movement of movements) {
      if (movement.type !== 'Outbound') {
        continue;
      }
      const date = new Date(movement.movementDate);
      const index = monthIndex.get(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
      if (index === undefined) {
        continue;
      }
      const key = `${movement.productId}-${movement.branchId}`;
      const values = used.get(key) ?? months.map(() => 0);
      values[index] += movement.quantity;
      used.set(key, values);
    }

    const requests = new Map<string, string[][]>();
    for (const request of purchases) {
      if (request.status === 'Canceled') {
        continue;
      }
      const index = monthIndex.get(request.requestDate.substring(0, 7));
      if (index === undefined) {
        continue;
      }
      const key = `${request.productId}-${request.branchId}`;
      const values = requests.get(key) ?? months.map(() => [] as string[]);
      values[index].push(request.number);
      requests.set(key, values);
    }

    const sorted = [...inventory].sort(
      (a, b) => a.branchName.localeCompare(b.branchName) || a.productName.localeCompare(b.productName),
    );

    const rows: ControlRow[] = sorted.map((item) => {
      const key = `${item.productId}-${item.branchId}`;
      const missing = Math.max(item.minimumQuantity - item.quantity, 0);
      return {
        key,
        branchName: item.branchName,
        branchRowSpan: 0,
        productName: item.productName,
        minimumQuantity: item.minimumQuantity,
        used: used.get(key) ?? months.map(() => 0),
        quantity: item.quantity,
        missing,
        status: missing > 0 ? 'REPOR' : 'OK',
        requests: (requests.get(key) ?? months.map(() => [])).map((numbers) => numbers.join(', ')),
      };
    });

    // Conta quantas linhas cada unidade ocupa, para mesclar a coluna UNIDADE.
    for (let start = 0; start < rows.length; ) {
      let end = start;
      while (end < rows.length && rows[end].branchName === rows[start].branchName) {
        end++;
      }
      rows[start].branchRowSpan = end - start;
      start = end;
    }

    return rows;
  }

  private buildSummary(inventory: ProductStock[], movements: StockMovement[]): SummaryRow[] {
    const totals = new Map<string, { inbound: number; outbound: number }>();
    for (const movement of movements) {
      const key = `${movement.productId}-${movement.branchId}`;
      const entry = totals.get(key) ?? { inbound: 0, outbound: 0 };
      if (movement.type === 'Inbound') {
        entry.inbound += movement.quantity;
      } else {
        entry.outbound += movement.quantity;
      }
      totals.set(key, entry);
    }

    return inventory.map((item) => {
      const key = `${item.productId}-${item.branchId}`;
      const moved = totals.get(key) ?? { inbound: 0, outbound: 0 };
      return {
        key,
        productName: item.productName,
        sku: item.sku,
        branchName: item.branchName,
        inbound: moved.inbound,
        outbound: moved.outbound,
        quantity: item.quantity,
        minimumQuantity: item.minimumQuantity,
        missing: Math.max(item.minimumQuantity - item.quantity, 0),
        lowStock: item.lowStock,
        openRequest: item.purchaseRequestNumber ?? '',
      };
    });
  }

  private loadBranches(): void {
    this.branchService.getAll('', 1, 100).subscribe({
      next: (result) => {
        this.branches.set(result.items);
        if (result.items.length > 0) {
          this.generate();
        }
      },
    });
  }
}
