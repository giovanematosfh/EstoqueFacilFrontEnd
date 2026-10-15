import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { BranchService } from '../../core/services/branch.service';
import { ProductStockService } from '../../core/services/product-stock.service';
import { PurchaseRequestService } from '../../core/services/purchase-request.service';
import { Branch } from '../../core/models/branch.model';
import { ProductStock } from '../../core/models/product-stock.model';
import { PurchaseRequest, PurchaseRequestStatus } from '../../core/models/purchase-request.model';
import { ReportColumn, exportToExcel } from '../../core/utils/export.util';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';
import { Pagination } from '../../shared/pagination/pagination';

const PAGE_SIZE = 10;

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const STATUS_LABELS: Record<PurchaseRequest['status'], string> = {
  Open: 'Aberta',
  Received: 'Recebida',
  Canceled: 'Cancelada',
};

type ComprasTab = 'history' | 'monthly';

interface MonthCell {
  quantity: number;
  numbers: string[];
}

interface MonthlyRow {
  productId: number;
  productName: string;
  sku: string;
  months: MonthCell[];
  total: number;
}

// Data local no formato aceito pela API (yyyy-MM-dd).
function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

@Component({
  selector: 'app-compras',
  imports: [ReactiveFormsModule, FormsModule, DatePipe, EmptyState, Icon, Pagination],
  templateUrl: './compras.html',
})
export class Compras implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly branchService = inject(BranchService);
  private readonly productStockService = inject(ProductStockService);
  private readonly purchaseRequestService = inject(PurchaseRequestService);
  private readonly searchInput$ = new Subject<string>();

  protected readonly PurchaseRequestStatus = PurchaseRequestStatus;
  protected readonly MONTHS = MONTHS;
  protected readonly STATUS_LABELS = STATUS_LABELS;

  protected readonly activeTab = signal<ComprasTab>('history');
  protected readonly branches = signal<Branch[]>([]);
  protected readonly selectedBranchId = signal<number | null>(null);
  protected readonly branchProductStocks = signal<ProductStock[]>([]);

  protected readonly requests = signal<PurchaseRequest[]>([]);
  protected readonly loading = signal(true);
  protected readonly searchTerm = signal('');
  protected readonly statusFilter = signal<PurchaseRequestStatus | null>(null);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly totalCount = signal(0);

  protected readonly year = signal(new Date().getFullYear());
  protected readonly yearRequests = signal<PurchaseRequest[]>([]);
  protected readonly monthlyLoading = signal(false);
  protected readonly monthlyRows = computed(() => this.buildMonthlyRows(this.yearRequests()));

  protected readonly showForm = signal(false);
  protected readonly saving = signal(false);
  protected readonly formError = signal('');

  protected readonly receiving = signal<PurchaseRequest | null>(null);
  protected readonly receiveError = signal('');
  protected readonly actionFor = signal<number | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    productId: this.fb.control<number | null>(null, Validators.required),
    number: ['', [Validators.required, Validators.maxLength(50)]],
    quantity: [1, [Validators.required, Validators.min(1)]],
    requestDate: [today(), Validators.required],
    requesterName: [''],
    notes: [''],
  });

  protected readonly receiveForm = this.fb.nonNullable.group({
    quantity: [1, [Validators.required, Validators.min(1)]],
    receivedDate: [today(), Validators.required],
  });

  constructor() {
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((term) => {
        this.searchTerm.set(term);
        this.page.set(1);
        this.loadRequests();
      });

    // Ao escolher o produto, sugere a quantidade que falta para chegar no mínimo.
    this.form.controls.productId.valueChanges.pipe(takeUntilDestroyed()).subscribe((productId) => {
      const stock = this.branchProductStocks().find((ps) => ps.productId === productId);
      if (stock) {
        this.form.controls.quantity.setValue(this.missingQuantity(stock));
      }
    });
  }

  ngOnInit(): void {
    this.loadBranches();
  }

  protected selectTab(tab: ComprasTab): void {
    this.activeTab.set(tab);
    if (tab === 'monthly') {
      this.loadMonthly();
    }
  }

  protected onBranchChange(branchId: number): void {
    this.selectedBranchId.set(branchId);
    this.searchTerm.set('');
    this.page.set(1);
    this.showForm.set(false);
    this.receiving.set(null);
    this.loadRequests();
    this.loadBranchProductStocks();
    if (this.activeTab() === 'monthly') {
      this.loadMonthly();
    }
  }

  protected onSearchInput(value: string): void {
    this.searchInput$.next(value);
  }

  protected onStatusChange(status: PurchaseRequestStatus | null): void {
    this.statusFilter.set(status);
    this.page.set(1);
    this.loadRequests();
  }

  protected onPageChange(page: number): void {
    this.page.set(page);
    this.loadRequests();
  }

  protected changeYear(delta: number): void {
    this.year.update((y) => y + delta);
    this.loadMonthly();
  }

  protected missingQuantity(stock: ProductStock): number {
    return Math.max(stock.minimumQuantity - stock.quantity, 1);
  }

  protected openForm(productId: number | null = null, quantity: number | null = null): void {
    this.formError.set('');
    this.receiving.set(null);
    this.form.reset({
      productId: null,
      number: '',
      quantity: 1,
      requestDate: today(),
      requesterName: '',
      notes: '',
    });
    if (productId) {
      this.form.controls.productId.setValue(productId);
    }
    if (quantity) {
      this.form.controls.quantity.setValue(quantity);
    }
    this.showForm.set(true);
  }

  protected closeForm(): void {
    this.showForm.set(false);
  }

  protected submitForm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const branchId = this.selectedBranchId();
    if (!branchId) {
      return;
    }

    this.saving.set(true);
    this.formError.set('');

    const raw = this.form.getRawValue();

    this.purchaseRequestService
      .create({
        productId: raw.productId!,
        branchId,
        number: raw.number.trim(),
        quantity: raw.quantity,
        requestDate: raw.requestDate,
        requesterName: raw.requesterName || null,
        notes: raw.notes || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showForm.set(false);
          this.refresh();
        },
        error: (err) => {
          this.saving.set(false);
          this.formError.set(err.error?.mensagem ?? 'Não foi possível salvar a solicitação de compra.');
        },
      });
  }

  protected openReceive(request: PurchaseRequest): void {
    this.showForm.set(false);
    this.receiveError.set('');
    this.receiveForm.reset({ quantity: request.quantity, receivedDate: today() });
    this.receiving.set(request);
  }

  protected closeReceive(): void {
    this.receiving.set(null);
  }

  protected submitReceive(): void {
    const request = this.receiving();
    if (!request) {
      return;
    }

    if (this.receiveForm.invalid) {
      this.receiveForm.markAllAsTouched();
      return;
    }

    this.actionFor.set(request.id);
    this.receiveError.set('');

    this.purchaseRequestService.receive(request.id, this.receiveForm.getRawValue()).subscribe({
      next: () => {
        this.actionFor.set(null);
        this.receiving.set(null);
        this.refresh();
      },
      error: (err) => {
        this.actionFor.set(null);
        this.receiveError.set(err.error?.mensagem ?? 'Não foi possível registrar o recebimento.');
      },
    });
  }

  protected cancelRequest(request: PurchaseRequest): void {
    if (!confirm(`Cancelar a SC nº ${request.number} de ${request.productName}?`)) {
      return;
    }

    this.actionFor.set(request.id);
    this.purchaseRequestService.cancel(request.id).subscribe({
      next: () => {
        this.actionFor.set(null);
        this.refresh();
      },
      error: () => this.actionFor.set(null),
    });
  }

  protected exportMonthly(): void {
    const rows = this.monthlyRows().map((row) => {
      const record: Record<string, string> = { produto: row.productName, sku: row.sku };
      row.months.forEach((cell, index) => {
        record[`m${index}`] = cell.quantity ? `${cell.quantity} (SC ${cell.numbers.join(', ')})` : '';
      });
      record['total'] = String(row.total);
      return record;
    });

    const columns: ReportColumn<Record<string, string>>[] = [
      { header: 'Produto', key: 'produto' },
      { header: 'SKU', key: 'sku' },
      ...MONTHS.map((month, index) => ({ header: month, key: `m${index}` })),
      { header: 'Total', key: 'total' },
    ];

    exportToExcel(rows, columns, `solicitacoes-compra-${this.year()}`);
  }

  private refresh(): void {
    this.loadRequests();
    this.loadBranchProductStocks();
    if (this.activeTab() === 'monthly') {
      this.loadMonthly();
    }
  }

  private buildMonthlyRows(requests: PurchaseRequest[]): MonthlyRow[] {
    const rows = new Map<number, MonthlyRow>();

    for (const request of requests) {
      if (request.status === 'Canceled') {
        continue;
      }

      let row = rows.get(request.productId);
      if (!row) {
        row = {
          productId: request.productId,
          productName: request.productName,
          sku: request.sku,
          months: MONTHS.map(() => ({ quantity: 0, numbers: [] })),
          total: 0,
        };
        rows.set(request.productId, row);
      }

      // requestDate vem como yyyy-MM-dd; lê o mês direto para não sofrer com fuso.
      const monthIndex = Number(request.requestDate.substring(5, 7)) - 1;
      row.months[monthIndex].quantity += request.quantity;
      row.months[monthIndex].numbers.push(request.number);
      row.total += request.quantity;
    }

    return [...rows.values()].sort((a, b) => a.productName.localeCompare(b.productName));
  }

  private loadBranches(): void {
    this.branchService.getAll('', 1, 100).subscribe({
      next: (result) => {
        this.branches.set(result.items);

        const params = this.route.snapshot.queryParamMap;
        const requestedBranch = Number(params.get('branchId'));
        const branch =
          result.items.find((b) => b.id === requestedBranch) ??
          result.items.find((b) => b.active) ??
          result.items[0];

        if (!branch) {
          this.loading.set(false);
          return;
        }

        this.selectedBranchId.set(branch.id);
        this.loadRequests();

        // Vindo do Estoque com "Solicitar": abre o formulário já preenchido.
        const productId = Number(params.get('productId')) || null;
        const quantity = Number(params.get('quantity')) || null;
        this.loadBranchProductStocks(() => {
          if (productId) {
            this.openForm(productId, quantity);
          }
        });
      },
      error: () => this.loading.set(false),
    });
  }

  private loadRequests(): void {
    const branchId = this.selectedBranchId();
    if (!branchId) {
      return;
    }

    this.loading.set(true);
    this.purchaseRequestService
      .getAll(branchId, this.searchTerm(), this.statusFilter(), this.page(), PAGE_SIZE)
      .subscribe({
        next: (result) => {
          this.requests.set(result.items);
          this.totalPages.set(result.totalPages);
          this.totalCount.set(result.totalCount);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  private loadMonthly(): void {
    const branchId = this.selectedBranchId();
    if (!branchId) {
      return;
    }

    const year = this.year();
    this.monthlyLoading.set(true);
    this.purchaseRequestService.getReport(branchId, `${year}-01-01`, `${year}-12-31`).subscribe({
      next: (items) => {
        this.yearRequests.set(items);
        this.monthlyLoading.set(false);
      },
      error: () => this.monthlyLoading.set(false),
    });
  }

  private loadBranchProductStocks(done?: () => void): void {
    const branchId = this.selectedBranchId();
    if (!branchId) {
      return;
    }

    this.productStockService.getReport(branchId).subscribe({
      next: (items) => {
        this.branchProductStocks.set(items);
        done?.();
      },
    });
  }
}
