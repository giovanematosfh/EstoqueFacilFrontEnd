import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { BranchService } from '../../core/services/branch.service';
import { ProductStockService } from '../../core/services/product-stock.service';
import { StockMovementService } from '../../core/services/stock-movement.service';
import { Branch } from '../../core/models/branch.model';
import { ProductStock } from '../../core/models/product-stock.model';
import { MovementType, StockMovement } from '../../core/models/stock-movement.model';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';
import { Pagination } from '../../shared/pagination/pagination';

const PAGE_SIZE = 10;

type EstoqueTab = 'movements' | 'levels';

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
  private readonly movementSearchInput$ = new Subject<string>();
  private readonly levelSearchInput$ = new Subject<string>();

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
  protected readonly savingMinimumFor = signal<number | null>(null);

  protected readonly saving = signal(false);
  protected readonly showForm = signal(false);
  protected readonly formError = signal('');

  protected readonly form = this.fb.nonNullable.group({
    productId: this.fb.control<number | null>(null, Validators.required),
    type: [MovementType.Inbound, Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
    reason: [''],
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
    this.loadMovements();
    this.loadLevels();
    this.loadBranchProductStocks();
  }

  protected openForm(): void {
    this.formError.set('');
    this.form.reset({ productId: null, type: MovementType.Inbound, quantity: 1, reason: '' });
    this.loadBranchProductStocks();
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

    this.stockMovementService
      .register({
        productId: raw.productId!,
        branchId,
        type: raw.type,
        quantity: raw.quantity,
        reason: raw.reason || null,
      })
      .subscribe({
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

  protected updateMinimum(productStock: ProductStock, value: string): void {
    const branchId = this.selectedBranchId();
    const minimumQuantity = Number(value);
    if (!branchId || Number.isNaN(minimumQuantity) || minimumQuantity < 0) {
      return;
    }

    this.savingMinimumFor.set(productStock.productId);
    this.productStockService.updateMinimum(branchId, productStock.productId, { minimumQuantity }).subscribe({
      next: (updated) => {
        this.levels.update((items) =>
          items.map((item) => (item.productId === updated.productId ? updated : item)),
        );
        this.savingMinimumFor.set(null);
      },
      error: () => this.savingMinimumFor.set(null),
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
          this.loadBranchProductStocks();
        } else {
          this.movementsLoading.set(false);
          this.levelsLoading.set(false);
        }
      },
      error: () => {
        this.movementsLoading.set(false);
        this.levelsLoading.set(false);
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
