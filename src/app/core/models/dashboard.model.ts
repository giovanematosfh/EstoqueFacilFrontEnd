export interface DashboardMovement {
  productName: string;
  branchName: string;
  type: string;
  quantity: number;
  movementDate: string;
}

export interface DashboardSummary {
  totalProducts: number;
  lowStockCount: number;
  totalStockValue: number;
  movementsToday: number;
  recentMovements: DashboardMovement[];
}
