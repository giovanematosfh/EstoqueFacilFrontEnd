import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { CreatePurchaseRequest, PurchaseRequest, UpdatePurchaseRequest } from '../models/purchase-request.model';
import { PagedResult } from '../models/paged-result.model';

@Injectable({ providedIn: 'root' })
export class PurchaseRequestService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/purchaserequests`;

  getByBranch(branchId: number, search = '', page = 1, pageSize = 10): Observable<PagedResult<PurchaseRequest>> {
    let params = new HttpParams().set('branchId', branchId).set('page', page).set('pageSize', pageSize);
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<PagedResult<PurchaseRequest>>(this.baseUrl, { params });
  }

  create(dto: CreatePurchaseRequest): Observable<PurchaseRequest> {
    return this.http.post<PurchaseRequest>(this.baseUrl, dto);
  }

  update(id: number, dto: UpdatePurchaseRequest): Observable<PurchaseRequest> {
    return this.http.put<PurchaseRequest>(`${this.baseUrl}/${id}`, dto);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
