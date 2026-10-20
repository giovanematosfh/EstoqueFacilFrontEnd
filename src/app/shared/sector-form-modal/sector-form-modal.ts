import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SectorService } from '../../core/services/sector.service';
import { Sector } from '../../core/models/sector.model';
import { Modal } from '../modal/modal';

// Cadastro/edição de setor em modal. Usado na tela de Setores e no atalho "Novo setor" da SC.
@Component({
  selector: 'app-sector-form-modal',
  imports: [ReactiveFormsModule, Modal],
  template: `
    <app-modal [title]="sector() ? 'Editar setor' : 'Novo setor'" size="sm" (closed)="closed.emit()">
      <form id="sectorForm" class="form-grid" [formGroup]="form" (ngSubmit)="submit()">
        <div class="field full-width">
          <label for="sectorName">Nome do setor</label>
          <input id="sectorName" type="text" maxlength="100" formControlName="name" placeholder="Ex.: Manutenção" />
          @if (form.controls.name.invalid && form.controls.name.touched) {
            <span class="field-error">Informe o nome do setor.</span>
          }
        </div>

        <div class="field full-width">
          <label for="sectorResponsible">Responsável</label>
          <input id="sectorResponsible" type="text" maxlength="150" formControlName="responsibleName" placeholder="Opcional" />
        </div>

        @if (sector()) {
          <label class="checkbox-field">
            <input type="checkbox" formControlName="active" />
            Setor ativo
          </label>
        }
      </form>

      @if (error()) {
        <div class="alert-error">{{ error() }}</div>
      }

      <ng-container modal-footer>
        <button class="btn btn-secondary" type="button" (click)="closed.emit()">Cancelar</button>
        <button class="btn btn-primary" type="submit" form="sectorForm" [disabled]="saving()">
          {{ saving() ? 'Salvando...' : 'Salvar setor' }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export class SectorFormModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly sectorService = inject(SectorService);

  sector = input<Sector | null>(null);
  saved = output<Sector>();
  closed = output<void>();

  protected readonly saving = signal(false);
  protected readonly error = signal('');

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    responsibleName: [''],
    active: [true],
  });

  ngOnInit(): void {
    const sector = this.sector();
    if (sector) {
      this.form.reset({ name: sector.name, responsibleName: sector.responsibleName ?? '', active: sector.active });
    }
    setTimeout(() => document.getElementById('sectorName')?.focus());
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set('');

    const raw = this.form.getRawValue();
    const dto = { name: raw.name.trim(), responsibleName: raw.responsibleName || null, active: raw.active };
    const sector = this.sector();
    const request = sector ? this.sectorService.update(sector.id, dto) : this.sectorService.create(dto);

    request.subscribe({
      next: (result) => {
        this.saving.set(false);
        this.saved.emit(result);
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err.error?.mensagem ?? 'Não foi possível salvar o setor.');
      },
    });
  }
}
