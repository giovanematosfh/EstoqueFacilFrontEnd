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
  expectedDeliveryDate?: string | null;
  sectorId?: number | null;
  sectorName?: string | null;
  paymentTerms?: string | null;
  supplier?: PurchaseRequestSupplier | null;
  // Soma dos itens com preço informado.
  totalAmount: number;
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
  unitPrice?: number | null;
  total?: number | null;
  status: PurchaseRequestStatusName;
  receivedDate?: string | null;
  receivedQuantity?: number | null;
}

export interface PurchaseRequestSupplier {
  id: number;
  name: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
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
  unitPrice?: number | null;
  total?: number | null;
  supplierName?: string | null;
  sectorName?: string | null;
  requestDate: string;
  status: PurchaseRequestStatusName;
  receivedDate?: string | null;
  receivedQuantity?: number | null;
  requesterName?: string | null;
  notes?: string | null;
  createdAt: string;
}

// Usado para criar e para editar a SC (enquanto nenhum item foi recebido).
export interface CreatePurchaseRequest {
  branchId: number;
  number: string;
  requestDate: string;
  expectedDeliveryDate?: string | null;
  supplierId?: number | null;
  sectorId?: number | null;
  paymentTerms?: string | null;
  requesterName?: string | null;
  notes?: string | null;
  items: { productId: number; quantity: number; unitPrice?: number | null }[];
}

// Itens com quantidade 0 continuam pendentes.
export interface ReceivePurchaseRequest {
  receivedDate: string;
  items: { itemId: number; quantity: number }[];
}
