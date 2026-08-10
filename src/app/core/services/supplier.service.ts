import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { CreateSupplier, Supplier, UpdateSupplier } from '../models/supplier.model';
import { PagedResult } from '../models/paged-result.model';

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/suppliers`;

  getAll(search = '', page = 1, pageSize = 10): Observable<PagedResult<Supplier>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<PagedResult<Supplier>>(this.baseUrl, { params });
  }

  getById(id: number): Observable<Supplier> {
    return this.http.get<Supplier>(`${this.baseUrl}/${id}`);
  }

  create(dto: CreateSupplier): Observable<Supplier> {
    return this.http.post<Supplier>(this.baseUrl, dto);
  }

  update(id: number, dto: UpdateSupplier): Observable<Supplier> {
    return this.http.put<Supplier>(`${this.baseUrl}/${id}`, dto);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
