import { Component, OnInit, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PlanService } from '../../core/services/plan.service';
import { Plan, SavePlan } from '../../core/models/saas.model';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';

@Component({
  selector: 'app-planos',
  imports: [ReactiveFormsModule, CurrencyPipe, EmptyState, Icon],
  templateUrl: './planos.html',
})
export class Planos implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly planService = inject(PlanService);

  protected readonly plans = signal<Plan[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly showForm = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly formError = signal('');

  // Limites vazios = ilimitado.
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    price: [0, [Validators.required, Validators.min(0)]],
    maxUsers: this.fb.control<number | null>(null, Validators.min(1)),
    maxBranches: this.fb.control<number | null>(null, Validators.min(1)),
    maxProducts: this.fb.control<number | null>(null, Validators.min(1)),
    active: [true],
  });

  ngOnInit(): void {
    this.loadPlans();
  }

  protected openCreateForm(): void {
    this.editingId.set(null);
    this.formError.set('');
    this.form.reset({ name: '', price: 0, maxUsers: null, maxBranches: null, maxProducts: null, active: true });
    this.showForm.set(true);
  }

  protected openEditForm(plan: Plan): void {
    this.editingId.set(plan.id);
    this.formError.set('');
    this.form.reset({
      name: plan.name,
      price: plan.price,
      maxUsers: plan.maxUsers,
      maxBranches: plan.maxBranches,
      maxProducts: plan.maxProducts,
      active: plan.active,
    });
    this.showForm.set(true);
  }

  protected closeForm(): void {
    this.showForm.set(false);
  }

  protected limit(value: number | null): string {
    return value === null ? 'Ilimitado' : value.toLocaleString('pt-BR');
  }

  protected submitForm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set('');

    const raw = this.form.getRawValue();
    const dto: SavePlan = {
      ...raw,
      maxUsers: raw.maxUsers || null,
      maxBranches: raw.maxBranches || null,
      maxProducts: raw.maxProducts || null,
    };
    const editingId = this.editingId();

    const request = editingId ? this.planService.update(editingId, dto) : this.planService.create(dto);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.loadPlans();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(err.error?.mensagem ?? 'Não foi possível salvar o plano.');
      },
    });
  }

  protected deletePlan(plan: Plan): void {
    if (!confirm(`Excluir o plano "${plan.name}"?`)) {
      return;
    }

    this.planService.remove(plan.id).subscribe({
      next: () => this.loadPlans(),
      error: (err) => alert(err.error?.mensagem ?? 'Não foi possível excluir o plano.'),
    });
  }

  private loadPlans(): void {
    this.loading.set(true);
    this.planService.getAll().subscribe({
      next: (plans) => {
        this.plans.set(plans);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
