import { Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { SupplierService } from '../../core/services/supplier.service';
import { Supplier } from '../../core/models/supplier.model';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';
import { Pagination } from '../../shared/pagination/pagination';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-fornecedores',
  imports: [ReactiveFormsModule, EmptyState, Icon, Pagination],
  templateUrl: './fornecedores.html',
})
export class Fornecedores implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly supplierService = inject(SupplierService);
  private readonly searchInput$ = new Subject<string>();

  protected readonly suppliers = signal<Supplier[]>([]);
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
    name: ['', [Validators.required, Validators.maxLength(150)]],
    document: [''],
    email: ['', [Validators.email]],
    phone: [''],
    address: [''],
  });

  constructor() {
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((term) => {
        this.searchTerm.set(term);
        this.page.set(1);
        this.loadSuppliers();
      });
  }

  ngOnInit(): void {
    this.loadSuppliers();
  }

  protected openCreateForm(): void {
    this.editingId.set(null);
    this.formError.set('');
    this.form.reset({ name: '', document: '', email: '', phone: '', address: '' });
    this.showForm.set(true);
  }

  protected openEditForm(supplier: Supplier): void {
    this.editingId.set(supplier.id);
    this.formError.set('');
    this.form.reset({
      name: supplier.name,
      document: supplier.document ?? '',
      email: supplier.email ?? '',
      phone: supplier.phone ?? '',
      address: supplier.address ?? '',
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
    this.loadSuppliers();
  }

  protected submitForm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set('');

    const raw = this.form.getRawValue();
    const dto = {
      name: raw.name,
      document: raw.document || null,
      email: raw.email || null,
      phone: raw.phone || null,
      address: raw.address || null,
    };
    const editingId = this.editingId();

    const request = editingId
      ? this.supplierService.update(editingId, dto)
      : this.supplierService.create(dto);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.loadSuppliers();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(err.error?.mensagem ?? 'Não foi possível salvar o fornecedor.');
      },
    });
  }

  protected deleteSupplier(supplier: Supplier): void {
    if (!confirm(`Excluir o fornecedor "${supplier.name}"?`)) {
      return;
    }

    this.supplierService.remove(supplier.id).subscribe({
      next: () => this.loadSuppliers(),
      error: (err) => alert(err.error?.mensagem ?? 'Não foi possível excluir o fornecedor.'),
    });
  }

  private loadSuppliers(): void {
    this.loading.set(true);
    this.supplierService.getAll(this.searchTerm(), this.page(), PAGE_SIZE).subscribe({
      next: (result) => {
        this.suppliers.set(result.items);
        this.totalPages.set(result.totalPages);
        this.totalCount.set(result.totalCount);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
