import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { PagedResult } from '../models/paged-result.model';
import { SaveSector, Sector } from '../models/sector.model';

@Injectable({ providedIn: 'root' })
export class SectorService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/sectors`;

  getAll(search = '', page = 1, pageSize = 10): Observable<PagedResult<Sector>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<PagedResult<Sector>>(this.baseUrl, { params });
  }

  create(dto: SaveSector): Observable<Sector> {
    return this.http.post<Sector>(this.baseUrl, dto);
  }

  update(id: number, dto: SaveSector): Observable<Sector> {
    return this.http.put<Sector>(`${this.baseUrl}/${id}`, dto);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
