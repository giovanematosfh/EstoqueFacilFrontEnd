// Planos e empresas (tenants) gerenciados pelo super admin.

export interface Plan {
  id: number;
  name: string;
  price: number;
  // null = ilimitado
  maxUsers: number | null;
  maxBranches: number | null;
  maxProducts: number | null;
  active: boolean;
  companyCount: number;
  createdAt: string;
}

export interface SavePlan {
  name: string;
  price: number;
  maxUsers: number | null;
  maxBranches: number | null;
  maxProducts: number | null;
  active: boolean;
}

export interface Company {
  id: number;
  name: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  active: boolean;
  // yyyy-MM-dd; null = sem vencimento
  dueDate?: string | null;
  createdAt: string;
  planId: number;
  planName: string;
  userCount: number;
  branchCount: number;
  productCount: number;
}

export interface CreateCompany {
  name: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  planId: number;
  dueDate?: string | null;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
}

export interface UpdateCompany {
  name: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  planId: number;
  dueDate?: string | null;
  active: boolean;
}
