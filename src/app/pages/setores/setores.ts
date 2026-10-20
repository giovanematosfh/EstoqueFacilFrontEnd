import { Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { SectorService } from '../../core/services/sector.service';
import { Sector } from '../../core/models/sector.model';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';
import { Pagination } from '../../shared/pagination/pagination';
import { SectorFormModal } from '../../shared/sector-form-modal/sector-form-modal';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-setores',
  imports: [EmptyState, Icon, Pagination, SectorFormModal],
  template: `
    <div class="page">
      <div class="page-toolbar">
        <header class="page-header">
          <h1>Setores</h1>
          <p>Setores da empresa que solicitam compras e retiram material do estoque.</p>
        </header>
        <button class="btn btn-primary" type="button" (click)="openForm(null)">
          <app-icon name="plus" [size]="16" />
          Novo Setor
        </button>
      </div>

      <div class="search-bar">
        <app-icon name="search" [size]="16" />
        <input
          type="text"
          placeholder="Buscar por nome ou responsável..."
          [value]="searchTerm()"
          (input)="searchInput$.next($any($event.target).value)"
        />
      </div>

      @if (loading()) {
        <div class="card"><p class="loading-text">Carregando setores...</p></div>
      } @else if (sectors().length === 0) {
        <app-empty-state
          icon="setores"
          [title]="searchTerm() ? 'Nenhum setor encontrado' : 'Nenhum setor cadastrado'"
          description="Clique em Novo Setor para cadastrar, por exemplo, Manutenção, Produção ou Administrativo."
        />
      } @else {
        <div class="card">
          <table class="table">
            <thead>
              <tr>
                <th>Setor</th>
                <th>Responsável</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (sector of sectors(); track sector.id) {
                <tr>
                  <td><strong>{{ sector.name }}</strong></td>
                  <td>{{ sector.responsibleName }}</td>
                  <td>
                    <span class="badge" [class.badge-in]="sector.active" [class.badge-out]="!sector.active">
                      {{ sector.active ? 'Ativo' : 'Inativo' }}
                    </span>
                  </td>
                  <td>
                    <div class="table-actions">
                      <button class="icon-btn" type="button" (click)="openForm(sector)" aria-label="Editar setor">
                        <app-icon name="edit" [size]="18" />
                      </button>
                      <button class="icon-btn" type="button" (click)="remove(sector)" aria-label="Excluir setor">
                        <app-icon name="delete" [size]="18" />
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
          <app-pagination
            [page]="page()"
            [totalPages]="totalPages()"
            [totalCount]="totalCount()"
            (pageChange)="onPageChange($event)"
          />
        </div>
      }
    </div>

    @if (editing(); as state) {
      <app-sector-form-modal [sector]="state.sector" (saved)="onSaved()" (closed)="editing.set(null)" />
    }
  `,
})
export class Setores implements OnInit {
  private readonly sectorService = inject(SectorService);
  protected readonly searchInput$ = new Subject<string>();

  protected readonly sectors = signal<Sector[]>([]);
  protected readonly loading = signal(true);
  protected readonly searchTerm = signal('');
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly totalCount = signal(0);

  // null = modal fechado; { sector: null } = novo setor.
  protected readonly editing = signal<{ sector: Sector | null } | null>(null);

  constructor() {
    this.searchInput$.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed()).subscribe((term) => {
      this.searchTerm.set(term);
      this.page.set(1);
      this.load();
    });
  }

  ngOnInit(): void {
    this.load();
  }

  protected openForm(sector: Sector | null): void {
    this.editing.set({ sector });
  }

  protected onSaved(): void {
    this.editing.set(null);
    this.load();
  }

  protected onPageChange(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected remove(sector: Sector): void {
    if (!confirm(`Excluir o setor "${sector.name}"?`)) {
      return;
    }

    this.sectorService.remove(sector.id).subscribe({
      next: () => this.load(),
      error: (err) => alert(err.error?.mensagem ?? 'Não foi possível excluir o setor.'),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.sectorService.getAll(this.searchTerm(), this.page(), PAGE_SIZE).subscribe({
      next: (result) => {
        this.sectors.set(result.items);
        this.totalPages.set(result.totalPages);
        this.totalCount.set(result.totalCount);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
