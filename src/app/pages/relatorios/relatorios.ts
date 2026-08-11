import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BranchService } from '../../core/services/branch.service';
import { ProductStockService } from '../../core/services/product-stock.service';
import { StockMovementService } from '../../core/services/stock-movement.service';
import { Branch } from '../../core/models/branch.model';
import { ProductStock } from '../../core/models/product-stock.model';
import { StockMovement } from '../../core/models/stock-movement.model';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';
import { ReportColumn, exportToExcel, exportToPdf } from '../../core/utils/export.util';

type ReportType = 'lowStock' | 'inventory' | 'movements';

const PRODUCT_STOCK_COLUMNS: ReportColumn<ProductStock>[] = [
  { header: 'Nome', key: 'productName' },
  { header: 'SKU', key: 'sku' },
  { header: 'Quantidade', key: 'quantity' },
  { header: 'Mínimo', key: 'minimumQuantity' },
];

const MOVEMENT_COLUMNS: ReportColumn<StockMovement>[] = [
  { header: 'Produto', key: 'productName' },
  { header: 'Filial', key: 'branchName' },
  { header: 'Tipo', key: 'type', format: (v) => (v === 'Inbound' ? 'Entrada' : 'Saída') },
  { header: 'Quantidade', key: 'quantity' },
  { header: 'Motivo', key: 'reason' },
  { header: 'Data', key: 'movementDate', format: (v) => formatDateTime(v as string) },
  { header: 'Saldo', key: 'stockBalanceAfter' },
];

function formatDateTime(value: string): string {
  return value ? new Date(value).toLocaleString('pt-BR') : '';
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Component({
  selector: 'app-relatorios',
  imports: [ReactiveFormsModule, FormsModule, DatePipe, EmptyState, Icon],
  templateUrl: './relatorios.html',
})
export class Relatorios implements OnInit {
  private readonly branchService = inject(BranchService);
  private readonly productStockService = inject(ProductStockService);
  private readonly stockMovementService = inject(StockMovementService);
  private readonly fb = inject(FormBuilder);

  protected readonly branches = signal<Branch[]>([]);
  protected readonly selectedBranchId = signal<number | null>(null);

  protected readonly activeReport = signal<ReportType>('lowStock');
  protected readonly loading = signal(false);

  protected readonly lowStockItems = signal<ProductStock[]>([]);
  protected readonly inventoryItems = signal<ProductStock[]>([]);
  protected readonly movements = signal<StockMovement[]>([]);

  protected readonly dateForm = this.fb.nonNullable.group({
    from: [isoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))],
    to: [isoDate(new Date())],
  });

  ngOnInit(): void {
    this.loadBranches();
  }

  protected onBranchChange(branchId: number): void {
    this.selectedBranchId.set(branchId);
    this.lowStockItems.set([]);
    this.inventoryItems.set([]);
    this.movements.set([]);
    this.loadForActiveReport();
  }

  protected selectReport(type: ReportType): void {
    this.activeReport.set(type);
    if (type === 'lowStock' && this.lowStockItems().length === 0) {
      this.loadLowStock();
    } else if (type === 'inventory' && this.inventoryItems().length === 0) {
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
        return this.lowStockItems().length > 0;
      case 'inventory':
        return this.inventoryItems().length > 0;
      case 'movements':
        return this.movements().length > 0;
    }
  }

  protected exportExcel(): void {
    switch (this.activeReport()) {
      case 'lowStock':
        exportToExcel(this.lowStockItems(), PRODUCT_STOCK_COLUMNS, 'estoque-baixo');
        break;
      case 'inventory':
        exportToExcel(this.inventoryItems(), PRODUCT_STOCK_COLUMNS, 'estoque-geral');
        break;
      case 'movements':
        exportToExcel(this.movements(), MOVEMENT_COLUMNS, 'movimentacoes');
        break;
    }
  }

  protected exportPdf(): void {
    switch (this.activeReport()) {
      case 'lowStock':
        exportToPdf(this.lowStockItems(), PRODUCT_STOCK_COLUMNS, 'estoque-baixo', 'Relatório de Estoque Baixo');
        break;
      case 'inventory':
        exportToPdf(this.inventoryItems(), PRODUCT_STOCK_COLUMNS, 'estoque-geral', 'Relatório de Estoque Geral');
        break;
      case 'movements':
        exportToPdf(this.movements(), MOVEMENT_COLUMNS, 'movimentacoes', 'Relatório de Movimentações');
        break;
    }
  }

  private loadBranches(): void {
    this.branchService.getAll('', 1, 100).subscribe({
      next: (result) => {
        this.branches.set(result.items);
        const active = result.items.find((b) => b.active) ?? result.items[0];
        if (active) {
          this.selectedBranchId.set(active.id);
          this.loadForActiveReport();
        }
      },
    });
  }

  private loadForActiveReport(): void {
    switch (this.activeReport()) {
      case 'lowStock':
        this.loadLowStock();
        break;
      case 'inventory':
        this.loadInventory();
        break;
      case 'movements':
        this.loadMovements();
        break;
    }
  }

  private loadLowStock(): void {
    const branchId = this.selectedBranchId();
    if (!branchId) {
      return;
    }

    this.loading.set(true);
    this.productStockService.getLowStock(branchId).subscribe({
      next: (items) => {
        this.lowStockItems.set(items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadInventory(): void {
    const branchId = this.selectedBranchId();
    if (!branchId) {
      return;
    }

    this.loading.set(true);
    this.productStockService.getReport(branchId).subscribe({
      next: (items) => {
        this.inventoryItems.set(items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadMovements(): void {
    const { from, to } = this.dateForm.getRawValue();
    this.loading.set(true);
    this.stockMovementService
      .getReport(`${from}T00:00:00`, `${to}T23:59:59`, this.selectedBranchId() ?? undefined)
      .subscribe({
        next: (movements) => {
          this.movements.set(movements);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
