import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { BranchService } from '../../core/services/branch.service';
import { ProductStockService } from '../../core/services/product-stock.service';
import { StockMovementService } from '../../core/services/stock-movement.service';
import { PurchaseRequestService } from '../../core/services/purchase-request.service';
import { Branch } from '../../core/models/branch.model';
import { ProductStock, UpdateProductStock } from '../../core/models/product-stock.model';
import { MovementType, StockMovement } from '../../core/models/stock-movement.model';
import { PurchaseRequest } from '../../core/models/purchase-request.model';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';
import { Pagination } from '../../shared/pagination/pagination';

const PAGE_SIZE = 10;

type EstoqueTab = 'movements' | 'levels' | 'purchaseRequests';

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Component({
  selector: 'app-estoque',
  imports: [ReactiveFormsModule, FormsModule, DatePipe, EmptyState, Icon, Pagination],
  templateUrl: './estoque.html',
})
export class Estoque implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly branchService = inject(BranchService);
  private readonly productStockService = inject(ProductStockService);
  private readonly stockMovementService = inject(StockMovementService);
  private readonly purchaseRequestService = inject(PurchaseRequestService);
  private readonly movementSearchInput$ = new Subject<string>();
  private readonly levelSearchInput$ = new Subject<string>();
  private readonly purchaseRequestSearchInput$ = new Subject<string>();

  protected readonly MovementType = MovementType;

  protected readonly activeTab = signal<EstoqueTab>('movements');
  protected readonly branches = signal<Branch[]>([]);
  protected readonly selectedBranchId = signal<number | null>(null);
  protected readonly branchProductStocks = signal<ProductStock[]>([]);

  protected readonly movements = signal<StockMovement[]>([]);
  protected readonly movementsLoading = signal(true);
  protected readonly movementSearchTerm = signal('');
  protected readonly movementPage = signal(1);
  protected readonly movementTotalPages = signal(1);
  protected readonly movementTotalCount = signal(0);

  protected readonly levels = signal<ProductStock[]>([]);
  protected readonly levelsLoading = signal(true);
  protected readonly levelSearchTerm = signal('');
  protected readonly levelPage = signal(1);
  protected readonly levelTotalPages = signal(1);
  protected readonly levelTotalCount = signal(0);
  protected readonly savingFieldFor = signal<number | null>(null);

  protected readonly purchaseRequests = signal<PurchaseRequest[]>([]);
  protected readonly purchaseRequestsLoading = signal(true);
  protected readonly purchaseRequestSearchTerm = signal('');
  protected readonly purchaseRequestPage = signal(1);
  protected readonly purchaseRequestTotalPages = signal(1);
  protected readonly purchaseRequestTotalCount = signal(0);

  protected readonly saving = signal(false);
  protected readonly showForm = signal(false);
  protected readonly formError = signal('');
  protected readonly editingMovementId = signal<number | null>(null);

  protected readonly savingPurchaseRequest = signal(false);
  protected readonly showPurchaseRequestForm = signal(false);
  protected readonly purchaseRequestFormError = signal('');
  protected readonly editingPurchaseRequestId = signal<number | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    productId: this.fb.control<number | null>(null, Validators.required),
    type: [MovementType.Inbound, Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
    reason: [''],
    requesterName: [''],
    sector: [''],
  });

  protected readonly purchaseRequestForm = this.fb.nonNullable.group({
    productId: this.fb.control<number | null>(null, Validators.required),
    requestNumber: ['', [Validators.required, Validators.maxLength(50)]],
    requestDate: [isoDate(new Date()), Validators.required],
  });

  constructor() {
    this.movementSearchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((term) => {
        this.movementSearchTerm.set(term);
        this.movementPage.set(1);
        this.loadMovements();
      });

    this.levelSearchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((term) => {
        this.levelSearchTerm.set(term);
        this.levelPage.set(1);
        this.loadLevels();
      });

    this.purchaseRequestSearchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((term) => {
        this.purchaseRequestSearchTerm.set(term);
        this.purchaseRequestPage.set(1);
        this.loadPurchaseRequests();
      });
  }

  ngOnInit(): void {
    this.loadBranches();
  }

  protected selectTab(tab: EstoqueTab): void {
    this.activeTab.set(tab);
  }

  protected onBranchChange(branchId: number): void {
    this.selectedBranchId.set(branchId);
    this.movementSearchTerm.set('');
    this.movementPage.set(1);
    this.levelSearchTerm.set('');
    this.levelPage.set(1);
    this.purchaseRequestSearchTerm.set('');
    this.purchaseRequestPage.set(1);
    this.loadMovements();
    this.loadLevels();
    this.loadPurchaseRequests();
    this.loadBranchProductStocks();
  }

  protected openForm(): void {
    this.editingMovementId.set(null);
    this.formError.set('');
    this.form.reset({
      productId: null,
      type: MovementType.Inbound,
      quantity: 1,
      reason: '',
      requesterName: '',
      sector: '',
    });
    this.form.controls.productId.enable();
    this.form.controls.type.enable();
    this.loadBranchProductStocks();
    this.showForm.set(true);
  }

  protected openEditMovementForm(movement: StockMovement): void {
    this.editingMovementId.set(movement.id);
    this.formError.set('');
    this.form.reset({
      productId: movement.productId,
      type: movement.type === 'Inbound' ? MovementType.Inbound : MovementType.Outbound,
      quantity: movement.quantity,
      reason: movement.reason ?? '',
      requesterName: movement.requesterName ?? '',
      sector: movement.sector ?? '',
    });
    this.form.controls.productId.disable();
    this.form.controls.type.disable();
    if (this.branchProductStocks().length === 0) {
      this.loadBranchProductStocks();
    }
    this.showForm.set(true);
  }

  protected closeForm(): void {
    this.showForm.set(false);
  }

  protected onMovementSearchInput(value: string): void {
    this.movementSearchInput$.next(value);
  }

  protected onMovementPageChange(page: number): void {
    this.movementPage.set(page);
    this.loadMovements();
  }

  protected onLevelSearchInput(value: string): void {
    this.levelSearchInput$.next(value);
  }

  protected onLevelPageChange(page: number): void {
    this.levelPage.set(page);
    this.loadLevels();
  }

  protected onPurchaseRequestSearchInput(value: string): void {
    this.purchaseRequestSearchInput$.next(value);
  }

  protected onPurchaseRequestPageChange(page: number): void {
    this.purchaseRequestPage.set(page);
    this.loadPurchaseRequests();
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
    const editingId = this.editingMovementId();

    const request = editingId
      ? this.stockMovementService.update(editingId, {
          quantity: raw.quantity,
          reason: raw.reason || null,
          requesterName: raw.requesterName || null,
          sector: raw.sector || null,
        })
      : this.stockMovementService.register({
          productId: raw.productId!,
          branchId,
          type: raw.type,
          quantity: raw.quantity,
          reason: raw.reason || null,
          requesterName: raw.requesterName || null,
          sector: raw.sector || null,
        });

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.loadMovements();
        this.loadLevels();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(err.error?.mensagem ?? 'Não foi possível registrar a movimentação.');
      },
    });
  }

  protected updateQuantity(productStock: ProductStock, value: string): void {
    const quantity = Number(value);
    if (Number.isNaN(quantity) || quantity < 0) {
      return;
    }

    this.saveProductStock(productStock, {
      quantity,
      minimumQuantity: productStock.minimumQuantity,
    });
  }

  protected updateMinimum(productStock: ProductStock, value: string): void {
    const minimumQuantity = Number(value);
    if (Number.isNaN(minimumQuantity) || minimumQuantity < 0) {
      return;
    }

    this.saveProductStock(productStock, {
      quantity: productStock.quantity,
      minimumQuantity,
    });
  }

  private saveProductStock(productStock: ProductStock, dto: UpdateProductStock): void {
    const branchId = this.selectedBranchId();
    if (!branchId) {
      return;
    }

    this.savingFieldFor.set(productStock.productId);
    this.productStockService.update(branchId, productStock.productId, dto).subscribe({
      next: (updated) => {
        this.levels.update((items) =>
          items.map((item) => (item.productId === updated.productId ? updated : item)),
        );
        this.savingFieldFor.set(null);
      },
      error: () => this.savingFieldFor.set(null),
    });
  }

  protected openPurchaseRequestForm(productId: number | null = null): void {
    this.editingPurchaseRequestId.set(null);
    this.purchaseRequestFormError.set('');
    this.purchaseRequestForm.reset({
      productId,
      requestNumber: '',
      requestDate: isoDate(new Date()),
    });
    this.purchaseRequestForm.controls.productId.enable();
    if (this.branchProductStocks().length === 0) {
      this.loadBranchProductStocks();
    }
    this.showPurchaseRequestForm.set(true);
  }

  protected openEditPurchaseRequestForm(purchaseRequest: PurchaseRequest): void {
    this.editingPurchaseRequestId.set(purchaseRequest.id);
    this.purchaseRequestFormError.set('');
    this.purchaseRequestForm.reset({
      productId: purchaseRequest.productId,
      requestNumber: purchaseRequest.requestNumber,
      requestDate: purchaseRequest.requestDate.slice(0, 10),
    });
    this.purchaseRequestForm.controls.productId.disable();
    if (this.branchProductStocks().length === 0) {
      this.loadBranchProductStocks();
    }
    this.showPurchaseRequestForm.set(true);
  }

  protected closePurchaseRequestForm(): void {
    this.showPurchaseRequestForm.set(false);
  }

  protected submitPurchaseRequestForm(): void {
    if (this.purchaseRequestForm.invalid) {
      this.purchaseRequestForm.markAllAsTouched();
      return;
    }

    const branchId = this.selectedBranchId();
    if (!branchId) {
      return;
    }

    this.savingPurchaseRequest.set(true);
    this.purchaseRequestFormError.set('');

    const raw = this.purchaseRequestForm.getRawValue();
    const editingId = this.editingPurchaseRequestId();

    const request = editingId
      ? this.purchaseRequestService.update(editingId, {
          requestNumber: raw.requestNumber,
          requestDate: raw.requestDate,
        })
      : this.purchaseRequestService.create({
          productId: raw.productId!,
          branchId,
          requestNumber: raw.requestNumber,
          requestDate: raw.requestDate,
        });

    request.subscribe({
      next: () => {
        this.savingPurchaseRequest.set(false);
        this.showPurchaseRequestForm.set(false);
        this.loadPurchaseRequests();
      },
      error: (err) => {
        this.savingPurchaseRequest.set(false);
        this.purchaseRequestFormError.set(err.error?.mensagem ?? 'Não foi possível registrar a solicitação de compra.');
      },
    });
  }

  protected deletePurchaseRequest(purchaseRequest: PurchaseRequest): void {
    if (!confirm(`Excluir a solicitação de compra "${purchaseRequest.requestNumber}"?`)) {
      return;
    }

    this.purchaseRequestService.remove(purchaseRequest.id).subscribe({
      next: () => this.loadPurchaseRequests(),
      error: (err) => alert(err.error?.mensagem ?? 'Não foi possível excluir a solicitação de compra.'),
    });
  }

  private loadBranches(): void {
    this.branchService.getAll('', 1, 100).subscribe({
      next: (result) => {
        this.branches.set(result.items);
        const active = result.items.find((b) => b.active) ?? result.items[0];
        if (active) {
          this.selectedBranchId.set(active.id);
          this.loadMovements();
          this.loadLevels();
          this.loadPurchaseRequests();
          this.loadBranchProductStocks();
        } else {
          this.movementsLoading.set(false);
          this.levelsLoading.set(false);
          this.purchaseRequestsLoading.set(false);
        }
      },
      error: () => {
        this.movementsLoading.set(false);
        this.levelsLoading.set(false);
        this.purchaseRequestsLoading.set(false);
      },
    });
  }

  private loadMovements(): void {
    const branchId = this.selectedBranchId();
    if (!branchId) {
      return;
    }

    this.movementsLoading.set(true);
    this.stockMovementService
      .getAll(this.movementSearchTerm(), branchId, this.movementPage(), PAGE_SIZE)
      .subscribe({
        next: (result) => {
          this.movements.set(result.items);
          this.movementTotalPages.set(result.totalPages);
          this.movementTotalCount.set(result.totalCount);
          this.movementsLoading.set(false);
        },
        error: () => this.movementsLoading.set(false),
      });
  }

  private loadLevels(): void {
    const branchId = this.selectedBranchId();
    if (!branchId) {
      return;
    }

    this.levelsLoading.set(true);
    this.productStockService
      .getByBranch(branchId, this.levelSearchTerm(), this.levelPage(), PAGE_SIZE)
      .subscribe({
        next: (result) => {
          this.levels.set(result.items);
          this.levelTotalPages.set(result.totalPages);
          this.levelTotalCount.set(result.totalCount);
          this.levelsLoading.set(false);
        },
        error: () => this.levelsLoading.set(false),
      });
  }

  private loadPurchaseRequests(): void {
    const branchId = this.selectedBranchId();
    if (!branchId) {
      return;
    }

    this.purchaseRequestsLoading.set(true);
    this.purchaseRequestService
      .getByBranch(branchId, this.purchaseRequestSearchTerm(), this.purchaseRequestPage(), PAGE_SIZE)
      .subscribe({
        next: (result) => {
          this.purchaseRequests.set(result.items);
          this.purchaseRequestTotalPages.set(result.totalPages);
          this.purchaseRequestTotalCount.set(result.totalCount);
          this.purchaseRequestsLoading.set(false);
        },
        error: () => this.purchaseRequestsLoading.set(false),
      });
  }

  private loadBranchProductStocks(): void {
    const branchId = this.selectedBranchId();
    if (!branchId) {
      return;
    }

    this.productStockService.getReport(branchId).subscribe({
      next: (items) => this.branchProductStocks.set(items),
    });
  }
}
