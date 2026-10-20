export enum PurchaseRequestStatus {
  Open = 1,
  Received = 2,
  Canceled = 3,
}

export type PurchaseRequestStatusName = 'Open' | 'Received' | 'Canceled';

// SC com seus itens (tela de Compras).
export interface PurchaseRequest {
  id: number;
  branchId: number;
  branchName: string;
  number: string;
  requestDate: string;
  // Open enquanto houver item pendente; Received se algum foi recebido; Canceled se todos cancelados.
  status: PurchaseRequestStatusName;
  requesterName?: string | null;
  notes?: string | null;
  createdAt: string;
  items: PurchaseRequestItem[];
}

export interface PurchaseRequestItem {
  id: number;
  productId: number;
  productName: string;
  sku: string;
  quantity: number;
  status: PurchaseRequestStatusName;
  receivedDate?: string | null;
  receivedQuantity?: number | null;
}

// Um item de SC com os dados da SC: base dos relatórios e da visão mensal por produto.
export interface PurchaseRequestLine {
  id: number;
  purchaseRequestId: number;
  productId: number;
  productName: string;
  sku: string;
  branchId: number;
  branchName: string;
  number: string;
  quantity: number;
  requestDate: string;
  status: PurchaseRequestStatusName;
  receivedDate?: string | null;
  receivedQuantity?: number | null;
  requesterName?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface CreatePurchaseRequest {
  branchId: number;
  number: string;
  requestDate: string;
  requesterName?: string | null;
  notes?: string | null;
  items: { productId: number; quantity: number }[];
}

// Itens com quantidade 0 continuam pendentes.
export interface ReceivePurchaseRequest {
  receivedDate: string;
  items: { itemId: number; quantity: number }[];
}
