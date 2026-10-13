import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Company, CreateCompany, UpdateCompany } from '../models/saas.model';

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/companies`;

  getAll(search = ''): Observable<Company[]> {
    const params = search ? new HttpParams().set('search', search) : undefined;
    return this.http.get<Company[]>(this.baseUrl, { params });
  }

  create(dto: CreateCompany): Observable<Company> {
    return this.http.post<Company>(this.baseUrl, dto);
  }

  update(id: number, dto: UpdateCompany): Observable<Company> {
    return this.http.put<Company>(`${this.baseUrl}/${id}`, dto);
  }
}
