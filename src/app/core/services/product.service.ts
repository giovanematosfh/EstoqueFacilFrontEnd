import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { CreateProduct, Product, UpdateProduct } from '../models/product.model';
import { PagedResult } from '../models/paged-result.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/products`;

  getAll(search = '', page = 1, pageSize = 10): Observable<PagedResult<Product>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<PagedResult<Product>>(this.baseUrl, { params });
  }

  getLowStock(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.baseUrl}/low-stock`);
  }

  getReport(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.baseUrl}/report`);
  }

  getById(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/${id}`);
  }

  create(dto: CreateProduct): Observable<Product> {
    return this.http.post<Product>(this.baseUrl, dto);
  }

  update(id: number, dto: UpdateProduct): Observable<Product> {
    return this.http.put<Product>(`${this.baseUrl}/${id}`, dto);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
