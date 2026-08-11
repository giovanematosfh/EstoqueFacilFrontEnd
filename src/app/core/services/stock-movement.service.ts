import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { CreateStockMovement, StockMovement } from '../models/stock-movement.model';
import { PagedResult } from '../models/paged-result.model';

@Injectable({ providedIn: 'root' })
export class StockMovementService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/stockmovements`;

  getAll(search = '', branchId?: number, page = 1, pageSize = 10): Observable<PagedResult<StockMovement>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (search) {
      params = params.set('search', search);
    }
    if (branchId) {
      params = params.set('branchId', branchId);
    }
    return this.http.get<PagedResult<StockMovement>>(this.baseUrl, { params });
  }

  getByProduct(productId: number): Observable<StockMovement[]> {
    return this.http.get<StockMovement[]>(`${this.baseUrl}/product/${productId}`);
  }

  getReport(from: string, to: string, branchId?: number): Observable<StockMovement[]> {
    let params = new HttpParams().set('from', from).set('to', to);
    if (branchId) {
      params = params.set('branchId', branchId);
    }
    return this.http.get<StockMovement[]>(`${this.baseUrl}/report`, { params });
  }

  register(dto: CreateStockMovement): Observable<StockMovement> {
    return this.http.post<StockMovement>(this.baseUrl, dto);
  }
}
