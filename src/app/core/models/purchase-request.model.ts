export enum PurchaseRequestStatus {
  Open = 1,
  Received = 2,
  Canceled = 3,
}

export interface PurchaseRequest {
  id: number;
  productId: number;
  productName: string;
  sku: string;
  branchId: number;
  branchName: string;
  number: string;
  quantity: number;
  requestDate: string;
  status: 'Open' | 'Received' | 'Canceled';
  receivedDate?: string | null;
  receivedQuantity?: number | null;
  requesterName?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface CreatePurchaseRequest {
  productId: number;
  branchId: number;
  number: string;
  quantity: number;
  requestDate: string;
  requesterName?: string | null;
  notes?: string | null;
}

export interface ReceivePurchaseRequest {
  quantity: number;
  receivedDate: string;
}
