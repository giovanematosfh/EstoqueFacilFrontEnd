export interface Product {
  id: number;
  name: string;
  description?: string | null;
  sku: string;
  price: number;
  active: boolean;
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
  categoryId: number;
}

export interface UpdateProduct {
  name: string;
  description?: string | null;
  price: number;
  active: boolean;
  categoryId: number;
}
