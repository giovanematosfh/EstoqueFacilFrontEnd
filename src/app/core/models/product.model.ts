export interface Product {
  id: number;
  name: string;
  description?: string | null;
  sku: string;
  price: number;
  stockQuantity: number;
  minimumStockQuantity: number;
  active: boolean;
  lowStock: boolean;
  createdAt: string;
  updatedAt?: string | null;
  categoryId: number;
  categoryName?: string | null;
}

export interface CreateProduct {
  name: string;
  description?: string | null;
  sku: string;
  price: number;
  stockQuantity: number;
  minimumStockQuantity: number;
  categoryId: number;
}

export interface UpdateProduct {
  name: string;
  description?: string | null;
  price: number;
  minimumStockQuantity: number;
  active: boolean;
  categoryId: number;
}
