export interface User {
  id: number;
  fullName: string;
  email: string;
  role: string;
  emailConfirmed: boolean;
  isActive: boolean;
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
