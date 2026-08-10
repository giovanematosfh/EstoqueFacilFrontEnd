import { Component, inject, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../../core/services/auth';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'app-topbar',
  imports: [Icon],
  templateUrl: './topbar.html',
  styleUrl: './topbar.css',
})
export class Topbar {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);

  toggleSidebar = output<void>();

  readonly userName = this.auth.currentUser;

  readonly pageTitle = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.resolveTitle()),
    ),
    { initialValue: this.resolveTitle() },
  );

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  private resolveTitle(): string {
    let snapshot: ActivatedRouteSnapshot | null = this.activatedRoute.root.snapshot;
    while (snapshot?.firstChild) {
      snapshot = snapshot.firstChild;
    }
    return snapshot?.title ?? 'Estoque Fácil';
  }
}
