export interface PurchaseRequest {
  id: number;
  productId: number;
  productName: string;
  sku: string;
  branchId: number;
  requestNumber: string;
  requestDate: string;
  createdAt: string;
}

export interface CreatePurchaseRequest {
  productId: number;
  branchId: number;
  requestNumber: string;
  requestDate: string;
}

export interface UpdatePurchaseRequest {
  requestNumber: string;
  requestDate: string;
}
