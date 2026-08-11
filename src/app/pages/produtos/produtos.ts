import { Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { CategoryService } from '../../core/services/category.service';
import { ProductService } from '../../core/services/product.service';
import { Category } from '../../core/models/category.model';
import { CreateProduct, Product, UpdateProduct } from '../../core/models/product.model';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';
import { Pagination } from '../../shared/pagination/pagination';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-produtos',
  imports: [ReactiveFormsModule, CurrencyPipe, EmptyState, Icon, Pagination],
  templateUrl: './produtos.html',
})
export class Produtos implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly productService = inject(ProductService);
  private readonly categoryService = inject(CategoryService);
  private readonly searchInput$ = new Subject<string>();

  protected readonly products = signal<Product[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly showForm = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly formError = signal('');

  protected readonly searchTerm = signal('');
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly totalCount = signal(0);

  constructor() {
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((term) => {
        this.searchTerm.set(term);
        this.page.set(1);
        this.loadProducts();
      });
  }

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    description: [''],
    sku: ['', [Validators.required, Validators.maxLength(50)]],
    categoryId: this.fb.control<number | null>(null, Validators.required),
    price: [0, [Validators.required, Validators.min(0.01)]],
    active: [true],
  });

  ngOnInit(): void {
    this.loadCategories();
    this.loadProducts();
  }

  protected openCreateForm(): void {
    this.editingId.set(null);
    this.formError.set('');
    this.form.reset({
      name: '',
      description: '',
      sku: '',
      categoryId: null,
      price: 0,
      active: true,
    });
    this.showForm.set(true);
  }

  protected openEditForm(product: Product): void {
    this.editingId.set(product.id);
    this.formError.set('');
    this.form.reset({
      name: product.name,
      description: product.description ?? '',
      sku: product.sku,
      categoryId: product.categoryId,
      price: product.price,
      active: product.active,
    });
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
    this.loadProducts();
  }

  protected submitForm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set('');

    const raw = this.form.getRawValue();
    const editingId = this.editingId();

    const request = editingId
      ? this.productService.update(editingId, this.toUpdateDto(raw))
      : this.productService.create(this.toCreateDto(raw));

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.loadProducts();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(err.error?.mensagem ?? 'Não foi possível salvar o produto.');
      },
    });
  }

  protected deleteProduct(product: Product): void {
    if (!confirm(`Excluir o produto "${product.name}"?`)) {
      return;
    }

    this.productService.remove(product.id).subscribe({
      next: () => this.loadProducts(),
      error: (err) => alert(err.error?.mensagem ?? 'Não foi possível excluir o produto.'),
    });
  }

  private loadProducts(): void {
    this.loading.set(true);
    this.productService.getAll(this.searchTerm(), this.page(), PAGE_SIZE).subscribe({
      next: (result) => {
        this.products.set(result.items);
        this.totalPages.set(result.totalPages);
        this.totalCount.set(result.totalCount);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadCategories(): void {
    this.categoryService.getAll('', 1, 100).subscribe({
      next: (result) => this.categories.set(result.items),
    });
  }

  private toCreateDto(raw: ReturnType<typeof this.form.getRawValue>): CreateProduct {
    return {
      name: raw.name,
      description: raw.description || null,
      sku: raw.sku,
      price: raw.price,
      categoryId: raw.categoryId!,
    };
  }

  private toUpdateDto(raw: ReturnType<typeof this.form.getRawValue>): UpdateProduct {
    return {
      name: raw.name,
      description: raw.description || null,
      price: raw.price,
      active: raw.active,
      categoryId: raw.categoryId!,
    };
  }
}
