export interface Category {
  id: number;
  name: string;
  description?: string | null;
  createdAt: string;
  productCount: number;
}

export interface CreateCategory {
  name: string;
  description?: string | null;
}

export interface UpdateCategory {
  name: string;
  description?: string | null;
}
