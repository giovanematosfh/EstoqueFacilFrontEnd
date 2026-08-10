import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth';
import { Icon } from '../../shared/icon/icon';

function passwordsMatchValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordsMismatch: true };
  };
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, Icon],
  templateUrl: './register.html',
})
export class Register {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal('');
  // Com a confirmação de e-mail desativada temporariamente, este signal fica sempre false
  // (o painel "verifique seu e-mail" no template não chega a aparecer) — reativar em submit() abaixo junto com o e-mail.
  protected readonly registered = signal(false);

  protected readonly form = this.fb.nonNullable.group(
    {
      fullName: ['', [Validators.required, Validators.maxLength(150)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatchValidator() },
  );

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set('');

    const { fullName, email, password } = this.form.getRawValue();

    this.auth.register(fullName, email, password).subscribe({
      // TODO: reativar quando a confirmação de e-mail voltar (mostrar o painel em vez de navegar direto).
      // next: () => {
      //   this.submitting.set(false);
      //   this.registered.set(true);
      // },
      next: () => this.router.navigateByUrl('/dashboard'),
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err.error?.mensagem ?? 'Não foi possível criar a conta. Tente novamente.');
      },
    });
  }
}
