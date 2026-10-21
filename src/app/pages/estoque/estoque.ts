import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { BranchService } from '../../core/services/branch.service';
import { ProductStockService } from '../../core/services/product-stock.service';
import { StockMovementService } from '../../core/services/stock-movement.service';
import { SectorService } from '../../core/services/sector.service';
import { Branch } from '../../core/models/branch.model';
import { ProductStock, UpdateProductStock } from '../../core/models/product-stock.model';
import { MovementType, StockMovement } from '../../core/models/stock-movement.model';
import { Sector } from '../../core/models/sector.model';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';
import { Pagination } from '../../shared/pagination/pagination';
import { Modal } from '../../shared/modal/modal';
import { SectorFormModal } from '../../shared/sector-form-modal/sector-form-modal';

const PAGE_SIZE = 10;

type EstoqueTab = 'movements' | 'levels';

@Component({
  selector: 'app-estoque',
  imports: [ReactiveFormsModule, FormsModule, DatePipe, RouterLink, EmptyState, Icon, Pagination, Modal, SectorFormModal],
  templateUrl: './estoque.html',
})
export class Estoque implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly branchService = inject(BranchService);
  private readonly productStockService = inject(ProductStockService);
  private readonly stockMovementService = inject(StockMovementService);
  private readonly sectorService = inject(SectorService);
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
  protected readonly savingFieldFor = signal<number | null>(null);

  protected readonly saving = signal(false);
  protected readonly showForm = signal(false);
  protected readonly formError = signal('');
  protected readonly sectors = signal<Sector[]>([]);
  protected readonly showSectorModal = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    productId: this.fb.control<number | null>(null, Validators.required),
    type: [MovementType.Inbound, Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
    reason: ['', Validators.maxLength(300)],
    requesterName: ['', Validators.maxLength(150)],
    sectorId: this.fb.control<number | null>(null),
  });

  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly selectedBranchName = computed(
    () => this.branches().find((b) => b.id === this.selectedBranchId())?.name ?? '',
  );

  protected readonly selectedProductStock = computed(() => {
    const productId = this.formValue().productId;
    return this.branchProductStocks().find((ps) => ps.productId === productId) ?? null;
  });

  protected readonly isOutbound = computed(() => this.formValue().type === MovementType.Outbound);

  // Saldo previsto do produto depois de registrar a movimentação.
  protected readonly projectedBalance = computed(() => {
    const stock = this.selectedProductStock();
    if (!stock) {
      return null;
    }
    const quantity = Number(this.formValue().quantity) || 0;
    return this.isOutbound() ? stock.quantity - quantity : stock.quantity + quantity;
  });

  protected readonly exceedsStock = computed(() => {
    const balance = this.projectedBalance();
    return this.isOutbound() && balance !== null && balance < 0;
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

  protected openForm(productId: number | null = null, type = MovementType.Inbound): void {
    this.formError.set('');
    this.form.reset({
      productId,
      type,
      quantity: 1,
      reason: '',
      requesterName: '',
      sectorId: null,
    });
    this.loadBranchProductStocks();
    this.loadSectors();
    this.showForm.set(true);
    setTimeout(() => document.getElementById(productId ? 'quantity' : 'productId')?.focus());
  }

  protected setType(type: MovementType): void {
    this.form.controls.type.setValue(type);
  }

  // Ao escolher o setor, sugere o responsável como solicitante se o campo estiver vazio.
  protected onSectorChange(sectorId: number | null): void {
    const sector = this.sectors().find((s) => s.id === sectorId);
    const requester = this.form.controls.requesterName;
    if (sector?.responsibleName && !requester.value.trim()) {
      requester.setValue(sector.responsibleName);
    }
  }

  protected onSectorCreated(sector: Sector): void {
    this.sectors.update((list) => [...list, sector].sort((a, b) => a.name.localeCompare(b.name)));
    this.form.controls.sectorId.setValue(sector.id);
    this.onSectorChange(sector.id);
    this.showSectorModal.set(false);
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
    if (this.form.invalid || this.exceedsStock()) {
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
    const sectorName = this.sectors().find((s) => s.id === raw.sectorId)?.name ?? null;

    this.stockMovementService
      .register({
        productId: raw.productId!,
        branchId,
        type: raw.type,
        quantity: raw.quantity,
        reason: raw.reason.trim() || null,
        requesterName: raw.requesterName.trim() || null,
        sector: sectorName,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showForm.set(false);
          this.loadMovements();
          this.loadLevels();
          this.loadBranchProductStocks();
        },
        error: (err) => {
          this.saving.set(false);
          this.formError.set(err.error?.mensagem ?? 'Não foi possível registrar a movimentação.');
        },
      });
  }

  protected updateMinimum(productStock: ProductStock, value: string): void {
    const minimumQuantity = Number(value);
    if (Number.isNaN(minimumQuantity) || minimumQuantity < 0) {
      return;
    }

    this.saveProductStock(productStock, {
      minimumQuantity,
      purchaseRequestNumber: productStock.purchaseRequestNumber ?? null,
    });
  }

  // Quanto falta para voltar ao estoque mínimo (0 quando não precisa repor).
  protected missingQuantity(productStock: ProductStock): number {
    return Math.max(productStock.minimumQuantity - productStock.quantity, 0);
  }

  private saveProductStock(productStock: ProductStock, dto: UpdateProductStock): void {
    const branchId = this.selectedBranchId();
    if (!branchId) {
      return;
    }

    this.savingFieldFor.set(productStock.productId);
    this.productStockService.updateMinimum(branchId, productStock.productId, dto).subscribe({
      next: (updated) => {
        this.levels.update((items) =>
          items.map((item) => (item.productId === updated.productId ? updated : item)),
        );
        this.savingFieldFor.set(null);
      },
      error: () => this.savingFieldFor.set(null),
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

  private loadSectors(): void {
    this.sectorService.getAll('', 1, 100).subscribe({
      next: (result) => this.sectors.set([...result.items].sort((a, b) => a.name.localeCompare(b.name))),
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
