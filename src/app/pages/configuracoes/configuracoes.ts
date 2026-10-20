import { Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { AccountService } from '../../core/services/account.service';
import { AuthService } from '../../core/services/auth';
import { UserService } from '../../core/services/user.service';
import { User } from '../../core/models/user.model';
import { Icon } from '../../shared/icon/icon';

// Valida que newPassword e confirmPassword do grupo são iguais.
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const { newPassword, confirmPassword } = group.value as { newPassword: string; confirmPassword: string };
  return newPassword && confirmPassword && newPassword !== confirmPassword ? { passwordsMismatch: true } : null;
}

@Component({
  selector: 'app-configuracoes',
  imports: [ReactiveFormsModule, Icon],
  templateUrl: './configuracoes.html',
})
export class Configuracoes implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly userService = inject(UserService);

  protected readonly isAdmin = this.auth.isAdmin;
  protected readonly currentUserId = this.auth.currentUser()?.id;

  protected readonly users = signal<User[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly showEditForm = signal(false);
  protected readonly editingUser = signal<User | null>(null);
  protected readonly formError = signal('');

  // password/role só valem no cadastro (editingUser null).
  protected readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(150)]],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    role: ['User'],
  });

  // Admin redefine a senha de outro usuário da empresa.
  protected readonly resettingUser = signal<User | null>(null);
  protected readonly resetSaving = signal(false);
  protected readonly resetError = signal('');
  protected readonly successMessage = signal('');
  protected readonly resetForm = this.fb.nonNullable.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  // Usuário logado troca a própria senha.
  private readonly accountService = inject(AccountService);
  protected readonly passwordSaving = signal(false);
  protected readonly passwordError = signal('');
  protected readonly passwordSuccess = signal('');
  protected readonly passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  ngOnInit(): void {
    if (this.isAdmin()) {
      this.loadUsers();
    }
  }

  protected openCreateForm(): void {
    this.editingUser.set(null);
    this.formError.set('');
    this.resettingUser.set(null);
    this.form.reset({ fullName: '', email: '', password: '', role: 'User' });
    this.form.controls.password.setValidators([Validators.required, Validators.minLength(6)]);
    this.form.controls.password.updateValueAndValidity();
    this.showEditForm.set(true);
  }

  protected openEditForm(user: User): void {
    this.editingUser.set(user);
    this.formError.set('');
    this.resettingUser.set(null);
    this.form.reset({ fullName: user.fullName, email: user.email, password: '', role: user.role });
    this.form.controls.password.clearValidators();
    this.form.controls.password.updateValueAndValidity();
    this.showEditForm.set(true);
  }

  protected closeEditForm(): void {
    this.showEditForm.set(false);
  }

  protected submitEditForm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const editingUser = this.editingUser();
    const { fullName, email, password, role } = this.form.getRawValue();

    this.saving.set(true);
    this.formError.set('');

    if (!editingUser) {
      this.userService.create({ fullName, email, password, role }).subscribe({
        next: (created) => {
          this.saving.set(false);
          this.showEditForm.set(false);
          this.users.update((list) => [...list, created].sort((a, b) => a.fullName.localeCompare(b.fullName)));
        },
        error: (err) => {
          this.saving.set(false);
          this.formError.set(err.error?.mensagem ?? 'Não foi possível cadastrar o usuário.');
        },
      });
      return;
    }

    this.userService.update(editingUser.id, { fullName, email }).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.showEditForm.set(false);
        this.users.update((list) => list.map((u) => (u.id === updated.id ? updated : u)));
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(err.error?.mensagem ?? 'Não foi possível salvar o usuário.');
      },
    });
  }

  protected onRoleChange(user: User, role: string): void {
    if (role === user.role) {
      return;
    }

    this.errorMessage.set('');
    this.userService.updateRole(user.id, { role }).subscribe({
      next: (updated) => {
        this.users.update((list) => list.map((u) => (u.id === updated.id ? updated : u)));
      },
      error: (err) => {
        this.errorMessage.set(err.error?.mensagem ?? 'Não foi possível alterar o papel do usuário.');
        this.loadUsers();
      },
    });
  }

  protected toggleStatus(user: User): void {
    const action = user.isActive ? 'desativar' : 'ativar';
    if (!confirm(`Deseja ${action} o usuário "${user.fullName}"?`)) {
      return;
    }

    this.errorMessage.set('');
    this.userService.updateStatus(user.id, { isActive: !user.isActive }).subscribe({
      next: (updated) => {
        this.users.update((list) => list.map((u) => (u.id === updated.id ? updated : u)));
      },
      error: (err) => {
        this.errorMessage.set(err.error?.mensagem ?? 'Não foi possível alterar o status do usuário.');
      },
    });
  }

  protected openResetForm(user: User): void {
    this.showEditForm.set(false);
    this.successMessage.set('');
    this.resetError.set('');
    this.resetForm.reset({ newPassword: '', confirmPassword: '' });
    this.resettingUser.set(user);
  }

  protected closeResetForm(): void {
    this.resettingUser.set(null);
  }

  protected submitResetPassword(): void {
    const target = this.resettingUser();
    if (!target) {
      return;
    }
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.resetSaving.set(true);
    this.resetError.set('');

    this.userService.resetPassword(target.id, this.resetForm.getRawValue().newPassword).subscribe({
      next: () => {
        this.resetSaving.set(false);
        this.resettingUser.set(null);
        this.successMessage.set(`Senha de ${target.fullName} redefinida.`);
      },
      error: (err) => {
        this.resetSaving.set(false);
        this.resetError.set(err.error?.mensagem ?? 'Não foi possível redefinir a senha.');
      },
    });
  }

  protected submitChangePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.passwordSaving.set(true);
    this.passwordError.set('');
    this.passwordSuccess.set('');

    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.accountService.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.passwordSaving.set(false);
        this.passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
        this.passwordSuccess.set('Senha alterada. Use a nova senha no próximo login.');
      },
      error: (err) => {
        this.passwordSaving.set(false);
        this.passwordError.set(err.error?.mensagem ?? 'Não foi possível alterar a senha.');
      },
    });
  }

  protected deleteUser(user: User): void {
    if (!confirm(`Excluir o usuário "${user.fullName}"?`)) {
      return;
    }

    this.userService.remove(user.id).subscribe({
      next: () => this.users.update((list) => list.filter((u) => u.id !== user.id)),
      error: (err) => alert(err.error?.mensagem ?? 'Não foi possível excluir o usuário.'),
    });
  }

  private loadUsers(): void {
    this.loading.set(true);
    this.userService.getAll().subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
