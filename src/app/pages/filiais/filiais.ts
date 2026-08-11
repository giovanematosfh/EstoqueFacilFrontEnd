import { Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { BranchService } from '../../core/services/branch.service';
import { Branch } from '../../core/models/branch.model';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';
import { Pagination } from '../../shared/pagination/pagination';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-filiais',
  imports: [ReactiveFormsModule, EmptyState, Icon, Pagination],
  templateUrl: './filiais.html',
})
export class Filiais implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly branchService = inject(BranchService);
  private readonly searchInput$ = new Subject<string>();

  protected readonly branches = signal<Branch[]>([]);
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
    address: [''],
    active: [true],
  });

  constructor() {
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((term) => {
        this.searchTerm.set(term);
        this.page.set(1);
        this.loadBranches();
      });
  }

  ngOnInit(): void {
    this.loadBranches();
  }

  protected openCreateForm(): void {
    this.editingId.set(null);
    this.formError.set('');
    this.form.reset({ name: '', address: '', active: true });
    this.showForm.set(true);
  }

  protected openEditForm(branch: Branch): void {
    this.editingId.set(branch.id);
    this.formError.set('');
    this.form.reset({ name: branch.name, address: branch.address ?? '', active: branch.active });
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
    this.loadBranches();
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
      ? this.branchService.update(editingId, { name: raw.name, address: raw.address || null, active: raw.active })
      : this.branchService.create({ name: raw.name, address: raw.address || null });

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.loadBranches();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(err.error?.mensagem ?? 'Não foi possível salvar a filial.');
      },
    });
  }

  protected deleteBranch(branch: Branch): void {
    if (!confirm(`Excluir a filial "${branch.name}"?`)) {
      return;
    }

    this.branchService.remove(branch.id).subscribe({
      next: () => this.loadBranches(),
      error: (err) => alert(err.error?.mensagem ?? 'Não foi possível excluir a filial.'),
    });
  }

  private loadBranches(): void {
    this.loading.set(true);
    this.branchService.getAll(this.searchTerm(), this.page(), PAGE_SIZE).subscribe({
      next: (result) => {
        this.branches.set(result.items);
        this.totalPages.set(result.totalPages);
        this.totalCount.set(result.totalCount);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
