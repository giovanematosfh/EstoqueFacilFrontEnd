import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Category, CreateCategory, UpdateCategory } from '../models/category.model';
import { PagedResult } from '../models/paged-result.model';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/categories`;

  getAll(search = '', page = 1, pageSize = 10): Observable<PagedResult<Category>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<PagedResult<Category>>(this.baseUrl, { params });
  }

  getById(id: number): Observable<Category> {
    return this.http.get<Category>(`${this.baseUrl}/${id}`);
  }

  create(dto: CreateCategory): Observable<Category> {
    return this.http.post<Category>(this.baseUrl, dto);
  }

  update(id: number, dto: UpdateCategory): Observable<Category> {
    return this.http.put<Category>(`${this.baseUrl}/${id}`, dto);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
