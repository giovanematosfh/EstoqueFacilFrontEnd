export interface User {
  id: number;
  fullName: string;
  email: string;
  role: string;
  emailConfirmed: boolean;
  isActive: boolean;
}

export interface CreateUser {
  fullName: string;
  email: string;
  password: string;
  role: string;
}

export interface UpdateUser {
  fullName: string;
  email: string;
}

export interface UpdateUserRole {
  role: string;
}

export interface UpdateUserStatus {
  isActive: boolean;
}
