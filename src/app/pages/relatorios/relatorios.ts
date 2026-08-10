import { Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ProductService } from '../../core/services/product.service';
import { StockMovementService } from '../../core/services/stock-movement.service';
import { Product } from '../../core/models/product.model';
import { StockMovement } from '../../core/models/stock-movement.model';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';
import { ReportColumn, exportToExcel, exportToPdf } from '../../core/utils/export.util';

type ReportType = 'lowStock' | 'inventory' | 'movements';

const PRODUCT_COLUMNS: ReportColumn<Product>[] = [
  { header: 'Nome', key: 'name' },
  { header: 'SKU', key: 'sku' },
  { header: 'Categoria', key: 'categoryName' },
  { header: 'Preço', key: 'price', format: (v) => formatCurrency(v as number) },
  { header: 'Estoque', key: 'stockQuantity' },
  { header: 'Mínimo', key: 'minimumStockQuantity' },
  { header: 'Status', key: 'active', format: (v) => (v ? 'Ativo' : 'Inativo') },
];

const MOVEMENT_COLUMNS: ReportColumn<StockMovement>[] = [
  { header: 'Produto', key: 'productName' },
  { header: 'Tipo', key: 'type', format: (v) => (v === 'Inbound' ? 'Entrada' : 'Saída') },
  { header: 'Quantidade', key: 'quantity' },
  { header: 'Motivo', key: 'reason' },
  { header: 'Data', key: 'movementDate', format: (v) => formatDateTime(v as string) },
  { header: 'Saldo', key: 'stockBalanceAfter' },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0);
}

function formatDateTime(value: string): string {
  return value ? new Date(value).toLocaleString('pt-BR') : '';
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Component({
  selector: 'app-relatorios',
  imports: [ReactiveFormsModule, CurrencyPipe, DatePipe, EmptyState, Icon],
  templateUrl: './relatorios.html',
})
export class Relatorios implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly stockMovementService = inject(StockMovementService);
  private readonly fb = inject(FormBuilder);

  protected readonly activeReport = signal<ReportType>('lowStock');
  protected readonly loading = signal(false);

  protected readonly lowStockProducts = signal<Product[]>([]);
  protected readonly inventoryProducts = signal<Product[]>([]);
  protected readonly movements = signal<StockMovement[]>([]);

  protected readonly dateForm = this.fb.nonNullable.group({
    from: [isoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))],
    to: [isoDate(new Date())],
  });

  ngOnInit(): void {
    this.loadLowStock();
  }

  protected selectReport(type: ReportType): void {
    this.activeReport.set(type);
    if (type === 'lowStock' && this.lowStockProducts().length === 0) {
      this.loadLowStock();
    } else if (type === 'inventory' && this.inventoryProducts().length === 0) {
      this.loadInventory();
    } else if (type === 'movements' && this.movements().length === 0) {
      this.loadMovements();
    }
  }

  protected generateMovementsReport(): void {
    this.loadMovements();
  }

  protected hasData(): boolean {
    switch (this.activeReport()) {
      case 'lowStock':
        return this.lowStockProducts().length > 0;
      case 'inventory':
        return this.inventoryProducts().length > 0;
      case 'movements':
        return this.movements().length > 0;
    }
  }

  protected exportExcel(): void {
    switch (this.activeReport()) {
      case 'lowStock':
        exportToExcel(this.lowStockProducts(), PRODUCT_COLUMNS, 'estoque-baixo');
        break;
      case 'inventory':
        exportToExcel(this.inventoryProducts(), PRODUCT_COLUMNS, 'estoque-geral');
        break;
      case 'movements':
        exportToExcel(this.movements(), MOVEMENT_COLUMNS, 'movimentacoes');
        break;
    }
  }

  protected exportPdf(): void {
    switch (this.activeReport()) {
      case 'lowStock':
        exportToPdf(this.lowStockProducts(), PRODUCT_COLUMNS, 'estoque-baixo', 'Relatório de Estoque Baixo');
        break;
      case 'inventory':
        exportToPdf(this.inventoryProducts(), PRODUCT_COLUMNS, 'estoque-geral', 'Relatório de Estoque Geral');
        break;
      case 'movements':
        exportToPdf(this.movements(), MOVEMENT_COLUMNS, 'movimentacoes', 'Relatório de Movimentações');
        break;
    }
  }

  private loadLowStock(): void {
    this.loading.set(true);
    this.productService.getLowStock().subscribe({
      next: (products) => {
        this.lowStockProducts.set(products);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadInventory(): void {
    this.loading.set(true);
    this.productService.getReport().subscribe({
      next: (products) => {
        this.inventoryProducts.set(products);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadMovements(): void {
    const { from, to } = this.dateForm.getRawValue();
    this.loading.set(true);
    this.stockMovementService.getReport(`${from}T00:00:00`, `${to}T23:59:59`).subscribe({
      next: (movements) => {
        this.movements.set(movements);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
