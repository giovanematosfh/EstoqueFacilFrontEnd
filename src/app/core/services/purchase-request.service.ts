import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import {
  CreatePurchaseRequest,
  PurchaseRequest,
  PurchaseRequestStatus,
  ReceivePurchaseRequest,
} from '../models/purchase-request.model';
import { PagedResult } from '../models/paged-result.model';

@Injectable({ providedIn: 'root' })
export class PurchaseRequestService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/purchaserequests`;

  getAll(
    branchId: number,
    search = '',
    status: PurchaseRequestStatus | null = null,
    page = 1,
    pageSize = 10,
  ): Observable<PagedResult<PurchaseRequest>> {
    let params = new HttpParams().set('branchId', branchId).set('page', page).set('pageSize', pageSize);
    if (search) {
      params = params.set('search', search);
    }
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<PagedResult<PurchaseRequest>>(this.baseUrl, { params });
  }

  // branchId null = todas as filiais.
  getReport(branchId: number | null, from: string, to: string): Observable<PurchaseRequest[]> {
    let params = new HttpParams().set('from', from).set('to', to);
    if (branchId) {
      params = params.set('branchId', branchId);
    }
    return this.http.get<PurchaseRequest[]>(`${this.baseUrl}/report`, { params });
  }

  create(dto: CreatePurchaseRequest): Observable<PurchaseRequest> {
    return this.http.post<PurchaseRequest>(this.baseUrl, dto);
  }

  receive(id: number, dto: ReceivePurchaseRequest): Observable<PurchaseRequest> {
    return this.http.post<PurchaseRequest>(`${this.baseUrl}/${id}/receive`, dto);
  }

  cancel(id: number): Observable<PurchaseRequest> {
    return this.http.post<PurchaseRequest>(`${this.baseUrl}/${id}/cancel`, {});
  }
}
