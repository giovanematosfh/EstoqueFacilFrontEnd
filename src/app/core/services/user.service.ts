import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { UpdateUser, UpdateUserRole, UpdateUserStatus, User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/users`;

  getAll(): Observable<User[]> {
    return this.http.get<User[]>(this.baseUrl);
  }

  update(id: number, dto: UpdateUser): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/${id}`, dto);
  }

  updateRole(id: number, dto: UpdateUserRole): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/${id}/role`, dto);
  }

  updateStatus(id: number, dto: UpdateUserStatus): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/${id}/status`, dto);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
