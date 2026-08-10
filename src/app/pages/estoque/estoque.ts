import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ProductService } from '../../core/services/product.service';
import { StockMovementService } from '../../core/services/stock-movement.service';
import { Product } from '../../core/models/product.model';
import { MovementType, StockMovement } from '../../core/models/stock-movement.model';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';
import { Pagination } from '../../shared/pagination/pagination';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-estoque',
  imports: [ReactiveFormsModule, DatePipe, EmptyState, Icon, Pagination],
  templateUrl: './estoque.html',
})
export class Estoque implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly productService = inject(ProductService);
  private readonly stockMovementService = inject(StockMovementService);
  private readonly searchInput$ = new Subject<string>();

  protected readonly MovementType = MovementType;

  protected readonly movements = signal<StockMovement[]>([]);
  protected readonly products = signal<Product[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly showForm = signal(false);
  protected readonly formError = signal('');

  protected readonly searchTerm = signal('');
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly totalCount = signal(0);

  protected readonly form = this.fb.nonNullable.group({
    productId: this.fb.control<number | null>(null, Validators.required),
    type: [MovementType.Inbound, Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
    reason: [''],
  });

  constructor() {
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((term) => {
        this.searchTerm.set(term);
        this.page.set(1);
        this.loadMovements();
      });
  }

  ngOnInit(): void {
    this.loadProducts();
    this.loadMovements();
  }

  protected openForm(): void {
    this.formError.set('');
    this.form.reset({ productId: null, type: MovementType.Inbound, quantity: 1, reason: '' });
    this.showForm.set(true);
  }

  protected closeForm(): void {
    this.showForm.set(false);
  }

  protected onSearchInput(value: string): void {
    this.searchInput$.next(value);
  }

  protected onPageChange(page: number): void {
    this.page.set(page);
    this.loadMovements();
  }

  protected submitForm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set('');

    const raw = this.form.getRawValue();

    this.stockMovementService
      .register({
        productId: raw.productId!,
        type: raw.type,
        quantity: raw.quantity,
        reason: raw.reason || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showForm.set(false);
          this.loadMovements();
          this.loadProducts();
        },
        error: (err) => {
          this.saving.set(false);
          this.formError.set(err.error?.mensagem ?? 'Não foi possível registrar a movimentação.');
        },
      });
  }

  private loadMovements(): void {
    this.loading.set(true);
    this.stockMovementService.getAll(this.searchTerm(), this.page(), PAGE_SIZE).subscribe({
      next: (result) => {
        this.movements.set(result.items);
        this.totalPages.set(result.totalPages);
        this.totalCount.set(result.totalCount);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadProducts(): void {
    this.productService.getAll('', 1, 100).subscribe({
      next: (result) => this.products.set(result.items),
    });
  }
}
