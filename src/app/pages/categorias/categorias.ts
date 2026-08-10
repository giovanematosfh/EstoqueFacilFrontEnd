import { Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { CategoryService } from '../../core/services/category.service';
import { Category } from '../../core/models/category.model';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';
import { Pagination } from '../../shared/pagination/pagination';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-categorias',
  imports: [ReactiveFormsModule, EmptyState, Icon, Pagination],
  templateUrl: './categorias.html',
})
export class Categorias implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly categoryService = inject(CategoryService);
  private readonly searchInput$ = new Subject<string>();

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

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: [''],
  });

  constructor() {
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((term) => {
        this.searchTerm.set(term);
        this.page.set(1);
        this.loadCategories();
      });
  }

  ngOnInit(): void {
    this.loadCategories();
  }

  protected openCreateForm(): void {
    this.editingId.set(null);
    this.formError.set('');
    this.form.reset({ name: '', description: '' });
    this.showForm.set(true);
  }

  protected openEditForm(category: Category): void {
    this.editingId.set(category.id);
    this.formError.set('');
    this.form.reset({ name: category.name, description: category.description ?? '' });
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
    this.loadCategories();
  }

  protected submitForm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set('');

    const raw = this.form.getRawValue();
    const dto = { name: raw.name, description: raw.description || null };
    const editingId = this.editingId();

    const request = editingId
      ? this.categoryService.update(editingId, dto)
      : this.categoryService.create(dto);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.loadCategories();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(err.error?.mensagem ?? 'Não foi possível salvar a categoria.');
      },
    });
  }

  protected deleteCategory(category: Category): void {
    if (!confirm(`Excluir a categoria "${category.name}"?`)) {
      return;
    }

    this.categoryService.remove(category.id).subscribe({
      next: () => this.loadCategories(),
      error: (err) => alert(err.error?.mensagem ?? 'Não foi possível excluir a categoria.'),
    });
  }

  private loadCategories(): void {
    this.loading.set(true);
    this.categoryService.getAll(this.searchTerm(), this.page(), PAGE_SIZE).subscribe({
      next: (result) => {
        this.categories.set(result.items);
        this.totalPages.set(result.totalPages);
        this.totalCount.set(result.totalCount);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
