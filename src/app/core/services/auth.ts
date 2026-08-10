import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import {
  AuthResponse,
  AuthUser,
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
} from '../models/auth.model';

const TOKEN_KEY = 'estoque-facil.token';
const USER_KEY = 'estoque-facil.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly token = signal<string | null>(this.readStorage(TOKEN_KEY));
  readonly currentUser = signal<AuthUser | null>(this.readUserStorage());
  readonly isAuthenticated = computed(() => {
    const token = this.token();
    return token !== null && !this.isExpired(token);
  });

  login(email: string, password: string): Observable<AuthResponse> {
    const body: LoginRequest = { email, password };
    return this.http
      .post<AuthResponse>(`${API_BASE_URL}/auth/login`, body)
      .pipe(tap((response) => this.storeSession(response)));
  }

  // TODO: reativar quando o SMTP estiver configurado corretamente (registro passa a exigir confirmação de e-mail).
  // register(fullName: string, email: string, password: string): Observable<RegisterResponse> {
  //   const body: RegisterRequest = { fullName, email, password };
  //   return this.http.post<RegisterResponse>(`${API_BASE_URL}/auth/register`, body);
  // }

  register(fullName: string, email: string, password: string): Observable<AuthResponse> {
    const body: RegisterRequest = { fullName, email, password };
    return this.http
      .post<AuthResponse>(`${API_BASE_URL}/auth/register`, body)
      .pipe(tap((response) => this.storeSession(response)));
  }

  confirmEmail(userId: number, token: string): Observable<void> {
    const params = { userId: userId.toString(), token };
    return this.http.get<void>(`${API_BASE_URL}/auth/confirm-email`, { params });
  }

  logout(): void {
    this.removeStorage(TOKEN_KEY);
    this.removeStorage(USER_KEY);
    this.token.set(null);
    this.currentUser.set(null);
  }

  private storeSession(response: AuthResponse): void {
    this.writeStorage(TOKEN_KEY, response.token);
    this.writeStorage(USER_KEY, JSON.stringify(response.user));
    this.token.set(response.token);
    this.currentUser.set(response.user);
  }

  private isExpired(token: string): boolean {
    const payload = this.decodeJwt(token);
    if (!payload?.exp) {
      return true;
    }
    return Date.now() >= payload.exp * 1000;
  }

  private decodeJwt(token: string): { exp?: number } | null {
    try {
      const [, payload] = token.split('.');
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(normalized));
    } catch {
      return null;
    }
  }

  private readUserStorage(): AuthUser | null {
    const raw = this.readStorage(USER_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }

  private readStorage(key: string): string | null {
    return this.isBrowser ? localStorage.getItem(key) : null;
  }

  private writeStorage(key: string, value: string): void {
    if (this.isBrowser) {
      localStorage.setItem(key, value);
    }
  }

  private removeStorage(key: string): void {
    if (this.isBrowser) {
      localStorage.removeItem(key);
    }
  }
}
