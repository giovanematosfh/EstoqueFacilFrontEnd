import { Component, HostListener, input, output } from '@angular/core';

// Exibe uma imagem ampliada sobre a tela; fecha com Esc, clique fora ou no X.
@Component({
  selector: 'app-image-viewer',
  template: `
    @if (src(); as url) {
      <div class="image-viewer" role="dialog" aria-modal="true" [attr.aria-label]="alt()" (click)="closed.emit()">
        <button class="image-viewer-close" type="button" aria-label="Fechar" (click)="closed.emit()">×</button>
        <figure (click)="$event.stopPropagation()">
          <img [src]="url" [alt]="alt()" />
          @if (alt()) {
            <figcaption>{{ alt() }}</figcaption>
          }
        </figure>
      </div>
    }
  `,
})
export class ImageViewer {
  src = input<string | null>(null);
  alt = input('');
  closed = output<void>();

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.src()) {
      this.closed.emit();
    }
  }
}
