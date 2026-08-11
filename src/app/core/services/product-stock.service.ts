import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { ProductStock, UpdateProductStock } from '../models/product-stock.model';
import { PagedResult } from '../models/paged-result.model';

@Injectable({ providedIn: 'root' })
export class ProductStockService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/productstocks`;

  getByBranch(branchId: number, search = '', page = 1, pageSize = 10): Observable<PagedResult<ProductStock>> {
    let params = new HttpParams().set('branchId', branchId).set('page', page).set('pageSize', pageSize);
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<PagedResult<ProductStock>>(this.baseUrl, { params });
  }

  getLowStock(branchId: number): Observable<ProductStock[]> {
    const params = new HttpParams().set('branchId', branchId);
    return this.http.get<ProductStock[]>(`${this.baseUrl}/low-stock`, { params });
  }

  getReport(branchId: number): Observable<ProductStock[]> {
    const params = new HttpParams().set('branchId', branchId);
    return this.http.get<ProductStock[]>(`${this.baseUrl}/report`, { params });
  }

  updateMinimum(branchId: number, productId: number, dto: UpdateProductStock): Observable<ProductStock> {
    const params = new HttpParams().set('branchId', branchId);
    return this.http.put<ProductStock>(`${this.baseUrl}/${productId}`, dto, { params });
  }
}
