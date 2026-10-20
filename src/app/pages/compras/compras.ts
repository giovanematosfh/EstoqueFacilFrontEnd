import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, startWith } from 'rxjs';
import { BranchService } from '../../core/services/branch.service';
import { ProductStockService } from '../../core/services/product-stock.service';
import { PurchaseRequestService } from '../../core/services/purchase-request.service';
import { Branch } from '../../core/models/branch.model';
import { ProductStock } from '../../core/models/product-stock.model';
import {
  PurchaseRequest,
  PurchaseRequestLine,
  PurchaseRequestStatus,
  PurchaseRequestStatusName,
} from '../../core/models/purchase-request.model';
import { ReportColumn, exportToExcel } from '../../core/utils/export.util';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';
import { Pagination } from '../../shared/pagination/pagination';

const PAGE_SIZE = 10;

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const STATUS_LABELS: Record<PurchaseRequestStatusName, string> = {
  Open: 'Aberta',
  Received: 'Recebida',
  Canceled: 'Cancelada',
};

const ITEM_STATUS_LABELS: Record<PurchaseRequestStatusName, string> = {
  Open: 'pendente',
  Received: 'recebido',
  Canceled: 'cancelado',
};

type ComprasTab = 'history' | 'monthly';

type ItemForm = FormGroup<{
  productId: FormControl<number | null>;
  quantity: FormControl<number>;
}>;

type ReceiveItemForm = FormGroup<{
  itemId: FormControl<number>;
  productName: FormControl<string>;
  requested: FormControl<number>;
  quantity: FormControl<number>;
}>;

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
  protected readonly ITEM_STATUS_LABELS = ITEM_STATUS_LABELS;

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
  protected readonly yearRequests = signal<PurchaseRequestLine[]>([]);
  protected readonly monthlyLoading = signal(false);
  protected readonly monthlyRows = computed(() => this.buildMonthlyRows(this.yearRequests()));

  protected readonly showForm = signal(false);
  protected readonly saving = signal(false);
  protected readonly formError = signal('');

  protected readonly receiving = signal<PurchaseRequest | null>(null);
  protected readonly receiveError = signal('');
  protected readonly actionFor = signal<number | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    number: ['', [Validators.required, Validators.maxLength(50)]],
    requestDate: [today(), Validators.required],
    requesterName: [''],
    notes: [''],
    items: this.fb.array<ItemForm>([]),
  });

  protected readonly receiveForm = this.fb.nonNullable.group({
    receivedDate: [today(), Validators.required],
    items: this.fb.array<ReceiveItemForm>([]),
  });

  // Produtos já escolhidos no formulário, para não repetir o mesmo produto em dois itens.
  private readonly itemsValue = toSignal(
    this.form.controls.items.valueChanges.pipe(startWith(this.form.controls.items.value)),
    { initialValue: [] },
  );
  protected readonly selectedProductIds = computed(
    () => new Set(this.itemsValue().map((item) => item.productId).filter((id): id is number => !!id)),
  );
  protected readonly lowStockToAdd = computed(() =>
    this.branchProductStocks().filter((ps) => ps.lowStock && !this.selectedProductIds().has(ps.productId)),
  );

  constructor() {
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((term) => {
        this.searchTerm.set(term);
        this.page.set(1);
        this.loadRequests();
      });
  }

  ngOnInit(): void {
    this.loadBranches();
  }

  protected get itemForms(): FormArray<ItemForm> {
    return this.form.controls.items;
  }

  protected get receiveItemForms(): FormArray<ReceiveItemForm> {
    return this.receiveForm.controls.items;
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

  protected stockLabel(stock: ProductStock): string {
    return `${stock.productName} (atual: ${stock.quantity} / mín: ${stock.minimumQuantity})`;
  }

  protected openForm(productId: number | null = null, quantity: number | null = null): void {
    this.formError.set('');
    this.receiving.set(null);
    this.form.reset({ number: '', requestDate: today(), requesterName: '', notes: '' });
    this.itemForms.clear();
    this.addItem(productId, quantity);
    this.showForm.set(true);
  }

  protected closeForm(): void {
    this.showForm.set(false);
  }

  protected addItem(productId: number | null = null, quantity: number | null = null): void {
    const group: ItemForm = this.fb.group({
      productId: this.fb.control<number | null>(productId, Validators.required),
      quantity: this.fb.nonNullable.control(quantity ?? this.suggestedQuantity(productId), [Validators.required, Validators.min(1)]),
    });

    // Ao escolher o produto, sugere a quantidade que falta para chegar no mínimo.
    group.controls.productId.valueChanges.subscribe((id) => {
      group.controls.quantity.setValue(this.suggestedQuantity(id));
    });

    this.itemForms.push(group);
  }

  protected removeItem(index: number): void {
    this.itemForms.removeAt(index);
  }

  // Preenche a SC com todos os itens da filial que estão abaixo do estoque de segurança.
  protected addLowStockItems(): void {
    // Remove a linha vazia inicial, se houver, antes de adicionar.
    for (let i = this.itemForms.length - 1; i >= 0; i--) {
      if (!this.itemForms.at(i).controls.productId.value) {
        this.itemForms.removeAt(i);
      }
    }
    for (const stock of this.lowStockToAdd()) {
      this.addItem(stock.productId, this.missingQuantity(stock));
    }
  }

  // O produto pode ser escolhido no item atual, mas não em outro item da mesma SC.
  protected isTakenElsewhere(productId: number, index: number): boolean {
    return this.selectedProductIds().has(productId) && this.itemForms.at(index).controls.productId.value !== productId;
  }

  protected submitForm(): void {
    if (this.itemForms.length === 0) {
      this.formError.set('Adicione ao menos um produto à SC.');
      return;
    }
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
        branchId,
        number: raw.number.trim(),
        requestDate: raw.requestDate,
        requesterName: raw.requesterName || null,
        notes: raw.notes || null,
        items: raw.items.map((item) => ({ productId: item.productId!, quantity: item.quantity })),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showForm.set(false);
          this.refresh();
        },
        error: (err) => {
          this.saving.set(false);
          this.formError.set(this.errorMessage(err, 'Não foi possível salvar a solicitação de compra.'));
        },
      });
  }

  protected openReceive(request: PurchaseRequest): void {
    this.showForm.set(false);
    this.receiveError.set('');
    this.receiveForm.reset({ receivedDate: today() });
    this.receiveItemForms.clear();

    for (const item of request.items.filter((i) => i.status === 'Open')) {
      this.receiveItemForms.push(
        this.fb.nonNullable.group({
          itemId: [item.id],
          productName: [item.productName],
          requested: [item.quantity],
          // Já vem com o que foi pedido; 0 deixa o item pendente para depois.
          quantity: [item.quantity, [Validators.required, Validators.min(0)]],
        }),
      );
    }

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

    const raw = this.receiveForm.getRawValue();
    const items = raw.items.map((item) => ({ itemId: item.itemId, quantity: item.quantity }));
    if (!items.some((item) => item.quantity > 0)) {
      this.receiveError.set('Informe a quantidade recebida de ao menos um item.');
      return;
    }

    this.actionFor.set(request.id);
    this.receiveError.set('');

    this.purchaseRequestService.receive(request.id, { receivedDate: raw.receivedDate, items }).subscribe({
      next: () => {
        this.actionFor.set(null);
        this.receiving.set(null);
        this.refresh();
      },
      error: (err) => {
        this.actionFor.set(null);
        this.receiveError.set(this.errorMessage(err, 'Não foi possível registrar o recebimento.'));
      },
    });
  }

  protected cancelRequest(request: PurchaseRequest): void {
    const pending = this.pendingCount(request);
    const received = request.items.length - pending;
    const detail = received > 0 ? ` Os ${received} item(ns) já recebido(s) continuam registrados.` : '';
    if (!confirm(`Cancelar os ${pending} item(ns) pendente(s) da SC nº ${request.number}?${detail}`)) {
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

  protected pendingCount(request: PurchaseRequest): number {
    return request.items.filter((i) => i.status === 'Open').length;
  }

  protected receivedCount(request: PurchaseRequest): number {
    return request.items.filter((i) => i.status === 'Received').length;
  }

  protected totalQuantity(request: PurchaseRequest): number {
    return request.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  // Ex.: "Aberta · 2 de 5 recebidos" ou "Recebida (parcial)".
  protected statusDetail(request: PurchaseRequest): string {
    const received = this.receivedCount(request);
    if (request.status === 'Open' && received > 0) {
      return `${received} de ${request.items.length} recebido(s)`;
    }
    if (request.status === 'Received' && received < request.items.length) {
      return 'parcial';
    }
    return '';
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

  private suggestedQuantity(productId: number | null): number {
    const stock = this.branchProductStocks().find((ps) => ps.productId === productId);
    return stock ? this.missingQuantity(stock) : 1;
  }

  // Erros da API: mensagem de negócio ou o primeiro erro de validação.
  private errorMessage(err: { error?: { mensagem?: string; errors?: Record<string, string[]> } }, fallback: string): string {
    const validation = err.error?.errors ? Object.values(err.error.errors).flat()[0] : undefined;
    return err.error?.mensagem ?? validation ?? fallback;
  }

  private refresh(): void {
    this.loadRequests();
    this.loadBranchProductStocks();
    if (this.activeTab() === 'monthly') {
      this.loadMonthly();
    }
  }

  private buildMonthlyRows(lines: PurchaseRequestLine[]): MonthlyRow[] {
    const rows = new Map<number, MonthlyRow>();

    for (const line of lines) {
      if (line.status === 'Canceled') {
        continue;
      }

      let row = rows.get(line.productId);
      if (!row) {
        row = {
          productId: line.productId,
          productName: line.productName,
          sku: line.sku,
          months: MONTHS.map(() => ({ quantity: 0, numbers: [] })),
          total: 0,
        };
        rows.set(line.productId, row);
      }

      // requestDate vem como yyyy-MM-dd; lê o mês direto para não sofrer com fuso.
      const monthIndex = Number(line.requestDate.substring(5, 7)) - 1;
      row.months[monthIndex].quantity += line.quantity;
      row.months[monthIndex].numbers.push(line.number);
      row.total += line.quantity;
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

        // Vindo do Estoque com "Solicitar": abre o formulário já com o produto.
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
