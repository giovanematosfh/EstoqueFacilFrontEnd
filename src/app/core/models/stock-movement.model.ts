export enum MovementType {
  Inbound = 1,
  Outbound = 2,
}

export interface StockMovement {
  id: number;
  productId: number;
  productName?: string | null;
  type: string;
  quantity: number;
  reason?: string | null;
  movementDate: string;
  stockBalanceAfter: number;
}

export interface CreateStockMovement {
  productId: number;
  type: MovementType;
  quantity: number;
  reason?: string | null;
}
