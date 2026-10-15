export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  isSuperAdmin: boolean;
  companyId: number;
  companyName: string;
  companyDueDate?: string | null;
}

export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: AuthUser;
}

export interface LoginRequest {
  email: string;
  password: string;
}
