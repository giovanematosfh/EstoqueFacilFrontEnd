import { Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subject, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { CategoryService } from '../../core/services/category.service';
import { ProductService, imageSrc } from '../../core/services/product.service';
import { Category } from '../../core/models/category.model';
import { CreateProduct, Product, UpdateProduct } from '../../core/models/product.model';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';
import { ImageViewer } from '../../shared/image-viewer/image-viewer';
import { Pagination } from '../../shared/pagination/pagination';

const PAGE_SIZE = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Component({
  selector: 'app-produtos',
  imports: [ReactiveFormsModule, CurrencyPipe, EmptyState, Icon, Pagination, ImageViewer],
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

  protected readonly imageSrc = imageSrc;

  // Foto escolhida no formulário: arquivo novo, ou remoção da atual. Só é enviada ao salvar.
  protected readonly imageFile = signal<File | null>(null);
  protected readonly imagePreview = signal<string | null>(null);
  protected readonly removeCurrentImage = signal(false);
  protected readonly imageError = signal('');

  protected readonly viewer = signal<{ src: string; alt: string } | null>(null);

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
    this.resetImage(null);
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
    this.resetImage(imageSrc(product.imageUrl));
    this.showForm.set(true);
  }

  protected closeForm(): void {
    this.showForm.set(false);
    this.resetImage(null);
  }

  protected onImageSelected(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    if (!IMAGE_TYPES.includes(file.type)) {
      this.imageError.set('Formato inválido. Envie uma imagem JPG, PNG ou WEBP.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.imageError.set('A imagem deve ter no máximo 5 MB.');
      return;
    }

    this.revokePreview();
    this.imageError.set('');
    this.imageFile.set(file);
    this.removeCurrentImage.set(false);
    this.imagePreview.set(URL.createObjectURL(file));
  }

  protected clearImage(): void {
    this.revokePreview();
    this.imageFile.set(null);
    this.imagePreview.set(null);
    this.removeCurrentImage.set(true);
  }

  protected openViewer(src: string | null, alt: string): void {
    if (src) {
      this.viewer.set({ src, alt });
    }
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

    request.pipe(switchMap((product) => this.saveImage(product.id))).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.resetImage(null);
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

  private saveImage(productId: number): Observable<unknown> {
    const file = this.imageFile();
    if (file) {
      return this.productService.uploadImage(productId, file);
    }
    if (this.removeCurrentImage() && this.editingId()) {
      return this.productService.removeImage(productId);
    }
    return of(null);
  }

  private resetImage(currentSrc: string | null): void {
    this.revokePreview();
    this.imageFile.set(null);
    this.imagePreview.set(currentSrc);
    this.removeCurrentImage.set(false);
    this.imageError.set('');
  }

  private revokePreview(): void {
    const preview = this.imagePreview();
    if (preview?.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
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
