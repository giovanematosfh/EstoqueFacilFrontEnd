import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { CompanyService } from '../../core/services/company.service';
import { PlanService } from '../../core/services/plan.service';
import { Company, Plan, UpdateCompany } from '../../core/models/saas.model';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { Icon } from '../../shared/icon/icon';

type DueStatus = { label: string; tone: 'ok' | 'warn' | 'late' };

@Component({
  selector: 'app-empresas',
  imports: [ReactiveFormsModule, DatePipe, EmptyState, Icon],
  templateUrl: './empresas.html',
})
export class Empresas implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly companyService = inject(CompanyService);
  private readonly planService = inject(PlanService);
  private readonly searchInput$ = new Subject<string>();

  protected readonly companies = signal<Company[]>([]);
  protected readonly plans = signal<Plan[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly showForm = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly formError = signal('');
  protected readonly searchTerm = signal('');

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    document: ['', Validators.maxLength(20)],
    email: ['', Validators.email],
    phone: ['', Validators.maxLength(20)],
    planId: this.fb.control<number | null>(null, Validators.required),
    dueDate: [''],
    active: [true],
    adminFullName: [''],
    adminEmail: [''],
    adminPassword: [''],
  });

  constructor() {
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((term) => {
        this.searchTerm.set(term);
        this.loadCompanies();
      });
  }

  ngOnInit(): void {
    this.planService.getAll().subscribe({ next: (plans) => this.plans.set(plans) });
    this.loadCompanies();
  }

  protected openCreateForm(): void {
    this.editingId.set(null);
    this.formError.set('');
    this.form.reset({
      name: '',
      document: '',
      email: '',
      phone: '',
      planId: null,
      dueDate: this.addDays(new Date(), 30),
      active: true,
      adminFullName: '',
      adminEmail: '',
      adminPassword: '',
    });
    this.setAdminValidators(true);
    this.showForm.set(true);
  }

  protected openEditForm(company: Company): void {
    this.editingId.set(company.id);
    this.formError.set('');
    this.form.reset({
      name: company.name,
      document: company.document ?? '',
      email: company.email ?? '',
      phone: company.phone ?? '',
      planId: company.planId,
      dueDate: company.dueDate ?? '',
      active: company.active,
      adminFullName: '',
      adminEmail: '',
      adminPassword: '',
    });
    this.setAdminValidators(false);
    this.showForm.set(true);
  }

  protected closeForm(): void {
    this.showForm.set(false);
  }

  protected onSearchInput(value: string): void {
    this.searchInput$.next(value);
  }

  protected submitForm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set('');

    const raw = this.form.getRawValue();
    const editingId = this.editingId();
    const company = {
      name: raw.name,
      document: raw.document || null,
      email: raw.email || null,
      phone: raw.phone || null,
      planId: raw.planId!,
      dueDate: raw.dueDate || null,
    };

    const request = editingId
      ? this.companyService.update(editingId, { ...company, active: raw.active })
      : this.companyService.create({
          ...company,
          adminFullName: raw.adminFullName,
          adminEmail: raw.adminEmail,
          adminPassword: raw.adminPassword,
        });

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.loadCompanies();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(err.error?.mensagem ?? 'Não foi possível salvar a empresa.');
      },
    });
  }

  // Registra um pagamento: estende 30 dias a partir do vencimento atual (ou de hoje, se já venceu).
  protected renew(company: Company): void {
    const today = this.addDays(new Date(), 0);
    const base = company.dueDate && company.dueDate > today ? new Date(`${company.dueDate}T00:00:00`) : new Date();
    const dueDate = this.addDays(base, 30);

    if (!confirm(`Renovar "${company.name}" até ${dueDate.split('-').reverse().join('/')}?`)) {
      return;
    }

    this.update(company, { dueDate, active: true });
  }

  protected toggleActive(company: Company): void {
    const action = company.active ? 'Bloquear' : 'Liberar';
    if (!confirm(`${action} o acesso de "${company.name}"?`)) {
      return;
    }

    this.update(company, { active: !company.active });
  }

  protected planLabel(plan: Plan): string {
    return `${plan.name} — ${plan.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês`;
  }

  protected dueStatus(company: Company): DueStatus {
    if (!company.dueDate) {
      return { label: 'Sem vencimento', tone: 'ok' };
    }

    const today = new Date(`${this.addDays(new Date(), 0)}T00:00:00`);
    const due = new Date(`${company.dueDate}T00:00:00`);
    const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);

    if (days < 0) {
      return { label: `Vencida há ${-days} dia(s)`, tone: 'late' };
    }
    if (days <= 7) {
      return { label: days === 0 ? 'Vence hoje' : `Vence em ${days} dia(s)`, tone: 'warn' };
    }
    return { label: 'Em dia', tone: 'ok' };
  }

  private update(company: Company, changes: Partial<UpdateCompany>): void {
    const dto: UpdateCompany = {
      name: company.name,
      document: company.document ?? null,
      email: company.email ?? null,
      phone: company.phone ?? null,
      planId: company.planId,
      dueDate: company.dueDate ?? null,
      active: company.active,
      ...changes,
    };

    this.companyService.update(company.id, dto).subscribe({
      next: () => this.loadCompanies(),
      error: (err) => alert(err.error?.mensagem ?? 'Não foi possível atualizar a empresa.'),
    });
  }

  private setAdminValidators(required: boolean): void {
    const { adminFullName, adminEmail, adminPassword } = this.form.controls;
    adminFullName.setValidators(required ? [Validators.required, Validators.maxLength(150)] : []);
    adminEmail.setValidators(required ? [Validators.required, Validators.email] : []);
    adminPassword.setValidators(required ? [Validators.required, Validators.minLength(6)] : []);
    [adminFullName, adminEmail, adminPassword].forEach((c) => c.updateValueAndValidity());
  }

  // yyyy-MM-dd no fuso local.
  private addDays(date: Date, days: number): string {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  private loadCompanies(): void {
    this.loading.set(true);
    this.companyService.getAll(this.searchTerm()).subscribe({
      next: (companies) => {
        this.companies.set(companies);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
