import { Component, HostListener, OnDestroy, OnInit, input, output } from '@angular/core';

// Pilha de modais abertos: Esc fecha só o de cima (ex.: "Novo setor" aberto sobre a SC).
const openModals: Modal[] = [];

// Janela modal com título, corpo e rodapé ([modal-footer]). Use dentro de um @if para abrir/fechar.
@Component({
  selector: 'app-modal',
  template: `
    <div class="modal-backdrop" [style.z-index]="zIndex" (mousedown)="onBackdrop($event)">
      <div
        class="modal-dialog"
        [class.modal-sm]="size() === 'sm'"
        [class.modal-lg]="size() === 'lg'"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
      >
        <header class="modal-header">
          <div>
            <h2>{{ title() }}</h2>
            @if (subtitle()) {
              <p>{{ subtitle() }}</p>
            }
          </div>
          <button class="icon-btn modal-close" type="button" aria-label="Fechar" (click)="closed.emit()">×</button>
        </header>
        <div class="modal-body">
          <ng-content />
        </div>
        <footer class="modal-footer">
          <ng-content select="[modal-footer]" />
        </footer>
      </div>
    </div>
  `,
})
export class Modal implements OnInit, OnDestroy {
  title = input.required<string>();
  subtitle = input('');
  size = input<'sm' | 'md' | 'lg'>('md');
  closed = output<void>();

  protected zIndex = 200;

  ngOnInit(): void {
    openModals.push(this);
    this.zIndex = 200 + openModals.length * 10;
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
  }

  ngOnDestroy(): void {
    openModals.splice(openModals.indexOf(this), 1);
    if (openModals.length === 0 && typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  }

  protected onBackdrop(event: MouseEvent): void {
    // Só fecha ao clicar no fundo, não ao soltar um arraste que começou dentro do modal.
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (openModals[openModals.length - 1] === this) {
      this.closed.emit();
    }
  }
}
