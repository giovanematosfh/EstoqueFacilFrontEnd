import { Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { DashboardService } from '../../core/services/dashboard.service';
import { DashboardMovement } from '../../core/models/dashboard.model';

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, CurrencyPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  private readonly dashboardService = inject(DashboardService);

  protected readonly loading = signal(true);
  protected readonly totalProducts = signal(0);
  protected readonly lowStockCount = signal(0);
  protected readonly totalStockValue = signal(0);
  protected readonly movementsToday = signal(0);
  protected readonly recentMovements = signal<DashboardMovement[]>([]);

  ngOnInit(): void {
    this.dashboardService.getSummary().subscribe({
      next: (summary) => {
        this.totalProducts.set(summary.totalProducts);
        this.lowStockCount.set(summary.lowStockCount);
        this.totalStockValue.set(summary.totalStockValue);
        this.movementsToday.set(summary.movementsToday);
        this.recentMovements.set(summary.recentMovements);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
