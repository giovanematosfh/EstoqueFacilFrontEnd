export interface ProductStock {
  productId: number;
  productName: string;
  sku: string;
  branchId: number;
  branchName: string;
  quantity: number;
  minimumQuantity: number;
  lowStock: boolean;
}

export interface UpdateProductStock {
  minimumQuantity: number;
}
