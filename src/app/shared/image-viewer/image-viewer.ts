import { Component, HostListener, computed, effect, input, output, signal } from '@angular/core';

const MAX_FIT_UPSCALE = 3;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.25;

// Exibe uma imagem ampliada sobre a tela, já ajustada ao maior tamanho que cabe nela.
// Zoom com rolagem, botões, teclas +/- ou duplo clique; arrasta para mover quando ampliada.
// Fecha com Esc, clique fora ou no X.
@Component({
  selector: 'app-image-viewer',
  template: `
    @if (src(); as url) {
      <div class="image-viewer" role="dialog" aria-modal="true" [attr.aria-label]="alt()" (click)="closed.emit()">
        <div class="image-viewer-stage" (wheel)="onWheel($event)">
          <img
            [src]="url"
            [alt]="alt()"
            draggable="false"
            [class.loaded]="loaded()"
            [class.animated]="animated()"
            [class.grabbable]="canPan()"
            [class.grabbing]="dragging()"
            [style.width.px]="natural().width"
            [style.height.px]="natural().height"
            [style.transform]="transform()"
            (load)="onLoad($event)"
            (click)="$event.stopPropagation()"
            (dblclick)="toggleZoom()"
            (pointerdown)="startDrag($event)"
            (pointermove)="drag($event)"
            (pointerup)="endDrag($event)"
            (pointercancel)="endDrag($event)"
          />
        </div>

        <div class="image-viewer-bar" (click)="$event.stopPropagation()">
          @if (alt()) {
            <span class="image-viewer-title">{{ alt() }}</span>
          }
          <div class="image-viewer-tools">
            <button type="button" aria-label="Diminuir zoom" title="Diminuir (-)" (click)="zoomBy(1 / zoomStep)">−</button>
            <span class="image-viewer-zoom">{{ zoomPercent() }}%</span>
            <button type="button" aria-label="Aumentar zoom" title="Aumentar (+)" (click)="zoomBy(zoomStep)">+</button>
            <button type="button" class="image-viewer-fit" title="Ajustar à tela (0)" (click)="fit()">Ajustar</button>
            <button type="button" class="image-viewer-fit" title="Tamanho real (1)" (click)="actualSize()">100%</button>
          </div>
        </div>

        <button class="image-viewer-close" type="button" aria-label="Fechar" (click)="closed.emit()">×</button>
      </div>
    }
  `,
})
export class ImageViewer {
  src = input<string | null>(null);
  alt = input('');
  closed = output<void>();

  protected readonly zoomStep = ZOOM_STEP;
  protected readonly loaded = signal(false);
  // Só anima o zoom depois do primeiro ajuste, para a foto não abrir "encolhendo".
  protected readonly animated = signal(false);
  protected readonly natural = signal({ width: 0, height: 0 });
  protected readonly scale = signal(1);
  protected readonly fitScale = signal(1);
  protected readonly offset = signal({ x: 0, y: 0 });
  protected readonly dragging = signal(false);

  protected readonly zoomPercent = computed(() => Math.round(this.scale() * 100));
  protected readonly canPan = computed(() => this.scale() > this.fitScale() + 0.001);
  protected readonly transform = computed(() => {
    const { x, y } = this.offset();
    return `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${this.scale()})`;
  });

  private dragStart = { x: 0, y: 0, offsetX: 0, offsetY: 0 };

  constructor() {
    // Nova imagem: volta ao estado inicial e trava a rolagem da página enquanto aberto.
    effect(() => {
      const open = !!this.src();
      this.loaded.set(false);
      this.animated.set(false);
      this.offset.set({ x: 0, y: 0 });
      if (typeof document !== 'undefined') {
        document.body.style.overflow = open ? 'hidden' : '';
      }
    });
  }

  protected onLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    this.natural.set({ width: img.naturalWidth, height: img.naturalHeight });
    this.fit();
    this.loaded.set(true);
    setTimeout(() => this.animated.set(true), 200);
  }

  protected fit(): void {
    const fitScale = this.computeFitScale();
    this.fitScale.set(fitScale);
    this.scale.set(fitScale);
    this.offset.set({ x: 0, y: 0 });
  }

  protected actualSize(): void {
    this.setScale(1);
  }

  protected toggleZoom(): void {
    const fitScale = this.fitScale();
    // Se já está ajustada, amplia (tamanho real, ou 2x quando a foto é pequena); senão volta a ajustar.
    if (Math.abs(this.scale() - fitScale) < 0.001) {
      this.setScale(fitScale >= 1 ? 1 : fitScale * 2);
    } else {
      this.fit();
    }
  }

  protected zoomBy(factor: number): void {
    this.setScale(this.scale() * factor);
  }

  protected onWheel(event: WheelEvent): void {
    event.preventDefault();
    this.zoomBy(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
  }

  protected startDrag(event: PointerEvent): void {
    if (!this.canPan()) {
      return;
    }
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    const { x, y } = this.offset();
    this.dragStart = { x: event.clientX, y: event.clientY, offsetX: x, offsetY: y };
    this.dragging.set(true);
  }

  protected drag(event: PointerEvent): void {
    if (!this.dragging()) {
      return;
    }
    this.offset.set({
      x: this.dragStart.offsetX + event.clientX - this.dragStart.x,
      y: this.dragStart.offsetY + event.clientY - this.dragStart.y,
    });
  }

  protected endDrag(event: PointerEvent): void {
    if (this.dragging()) {
      (event.target as HTMLElement).releasePointerCapture(event.pointerId);
      this.dragging.set(false);
    }
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(event: KeyboardEvent): void {
    if (!this.src()) {
      return;
    }
    switch (event.key) {
      case 'Escape':
        this.closed.emit();
        break;
      case '+':
      case '=':
        this.zoomBy(ZOOM_STEP);
        break;
      case '-':
        this.zoomBy(1 / ZOOM_STEP);
        break;
      case '0':
        this.fit();
        break;
      case '1':
        this.actualSize();
        break;
    }
  }

  @HostListener('window:resize')
  protected onResize(): void {
    if (!this.src() || !this.loaded()) {
      return;
    }
    const wasFitted = !this.canPan();
    this.fitScale.set(this.computeFitScale());
    if (wasFitted) {
      this.fit();
    }
  }

  private setScale(scale: number): void {
    const clamped = Math.min(Math.max(scale, Math.min(MIN_ZOOM, this.fitScale())), MAX_ZOOM);
    this.scale.set(clamped);
    if (clamped <= this.fitScale() + 0.001) {
      this.offset.set({ x: 0, y: 0 });
    }
  }

  // Maior escala em que a imagem inteira cabe na área livre da tela (barra e margens descontadas).
  private computeFitScale(): number {
    const { width, height } = this.natural();
    if (!width || !height || typeof window === 'undefined') {
      return 1;
    }
    const gutter = window.innerWidth < 600 ? 16 : 48;
    const availableWidth = window.innerWidth - gutter * 2;
    const availableHeight = window.innerHeight - gutter * 2 - 64;
    if (availableWidth <= 0 || availableHeight <= 0) {
      return 1;
    }
    return Math.min(availableWidth / width, availableHeight / height, MAX_FIT_UPSCALE);
  }
}
