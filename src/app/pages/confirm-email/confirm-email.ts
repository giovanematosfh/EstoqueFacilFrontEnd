import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth';
import { Icon } from '../../shared/icon/icon';

type ConfirmState = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-confirm-email',
  imports: [RouterLink, Icon],
  templateUrl: './confirm-email.html',
})
export class ConfirmEmail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  protected readonly state = signal<ConfirmState>('loading');
  protected readonly errorMessage = signal('');

  ngOnInit(): void {
    const userId = Number(this.route.snapshot.queryParamMap.get('userId'));
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!userId || !token) {
      this.state.set('error');
      this.errorMessage.set('Link de confirmação inválido.');
      return;
    }

    this.auth.confirmEmail(userId, token).subscribe({
      next: () => this.state.set('success'),
      error: (err) => {
        this.state.set('error');
        this.errorMessage.set(err.error?.mensagem ?? 'Não foi possível confirmar o e-mail.');
      },
    });
  }
}
