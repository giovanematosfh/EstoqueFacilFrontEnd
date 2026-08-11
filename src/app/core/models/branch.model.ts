export interface Branch {
  id: number;
  name: string;
  address?: string | null;
  active: boolean;
  createdAt: string;
}

export interface CreateBranch {
  name: string;
  address?: string | null;
}

export interface UpdateBranch {
  name: string;
  address?: string | null;
  active: boolean;
}
