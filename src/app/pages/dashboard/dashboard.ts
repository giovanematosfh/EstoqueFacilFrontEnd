import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { BranchService } from '../../core/services/branch.service';
import { ProductService } from '../../core/services/product.service';
import { ProductStockService } from '../../core/services/product-stock.service';
import { StockMovementService } from '../../core/services/stock-movement.service';
import { StockMovement } from '../../core/models/stock-movement.model';
import { EmptyState } from '../../shared/empty-state/empty-state';

interface StatCard {
  label: string;
  value: string;
  warning?: boolean;
}

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, RouterLink, EmptyState],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly branchService = inject(BranchService);
  private readonly productStockService = inject(ProductStockService);
  private readonly stockMovementService = inject(StockMovementService);

  protected readonly loading = signal(true);
  protected readonly stats = signal<StatCard[]>([]);
  protected readonly movimentacoes = signal<StockMovement[]>([]);

  ngOnInit(): void {
    const branches$ = this.branchService.getAll('', 1, 100);

    const lowStock$ = branches$.pipe(
      switchMap((result) =>
        result.items.length === 0
          ? of(0)
          : forkJoin(result.items.map((b) => this.productStockService.getLowStock(b.id))).pipe(
              map((lists) => lists.reduce((total, list) => total + list.length, 0)),
            ),
      ),
    );

    forkJoin({
      products: this.productService.getAll('', 1, 1),
      branches: branches$,
      lowStock: lowStock$,
      movements: this.stockMovementService.getAll('', undefined, 1, 5),
    }).subscribe({
      next: ({ products, branches, lowStock, movements }) => {
        this.stats.set([
          { label: 'Total de Produtos', value: this.format(products.totalCount) },
          { label: 'Filiais', value: this.format(branches.totalCount) },
          { label: 'Itens com Estoque Baixo', value: this.format(lowStock), warning: lowStock > 0 },
          { label: 'Movimentações Registradas', value: this.format(movements.totalCount) },
        ]);
        this.movimentacoes.set(movements.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private format(value: number): string {
    return value.toLocaleString('pt-BR');
  }
}
