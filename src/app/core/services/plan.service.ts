import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Plan, SavePlan } from '../models/saas.model';

@Injectable({ providedIn: 'root' })
export class PlanService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/plans`;

  getAll(): Observable<Plan[]> {
    return this.http.get<Plan[]>(this.baseUrl);
  }

  create(dto: SavePlan): Observable<Plan> {
    return this.http.post<Plan>(this.baseUrl, dto);
  }

  update(id: number, dto: SavePlan): Observable<Plan> {
    return this.http.put<Plan>(`${this.baseUrl}/${id}`, dto);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
