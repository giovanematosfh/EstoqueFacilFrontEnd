export interface Sector {
  id: number;
  name: string;
  responsibleName?: string | null;
  active: boolean;
  createdAt: string;
}

export interface SaveSector {
  name: string;
  responsibleName?: string | null;
  active: boolean;
}
