import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Branch, CreateBranch, UpdateBranch } from '../models/branch.model';
import { PagedResult } from '../models/paged-result.model';

@Injectable({ providedIn: 'root' })
export class BranchService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/branches`;

  getAll(search = '', page = 1, pageSize = 10): Observable<PagedResult<Branch>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<PagedResult<Branch>>(this.baseUrl, { params });
  }

  getById(id: number): Observable<Branch> {
    return this.http.get<Branch>(`${this.baseUrl}/${id}`);
  }

  create(dto: CreateBranch): Observable<Branch> {
    return this.http.post<Branch>(this.baseUrl, dto);
  }

  update(id: number, dto: UpdateBranch): Observable<Branch> {
    return this.http.put<Branch>(`${this.baseUrl}/${id}`, dto);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
