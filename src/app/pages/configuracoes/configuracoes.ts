import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth';
import { UserService } from '../../core/services/user.service';
import { User } from '../../core/models/user.model';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'app-configuracoes',
  imports: [ReactiveFormsModule, EmptyState, Icon],
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

  protected readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(150)]],
    email: ['', [Validators.required, Validators.email]],
  });

  ngOnInit(): void {
    if (this.isAdmin()) {
      this.loadUsers();
    }
  }

  protected openEditForm(user: User): void {
    this.editingUser.set(user);
    this.formError.set('');
    this.form.reset({ fullName: user.fullName, email: user.email });
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
    if (!editingUser) {
      return;
    }

    this.saving.set(true);
    this.formError.set('');

    this.userService.update(editingUser.id, this.form.getRawValue()).subscribe({
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
