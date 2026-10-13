import { Component, input } from '@angular/core';

// Rodapé usado no sistema (variant "app") e nas telas de entrada (variant "auth").
@Component({
  selector: 'app-footer',
  template: `
    <footer class="app-footer" [class.app-footer-auth]="variant() === 'auth'">
      <span>© {{ year }} <strong>Estoque Fácil</strong> · Todos os direitos reservados.</span>
      <span class="app-footer-credit">Desenvolvido por <strong>BMG Tech</strong> · v{{ version }}</span>
    </footer>
  `,
})
export class Footer {
  variant = input<'app' | 'auth'>('app');

  protected readonly year = new Date().getFullYear();
  protected readonly version = '2.0';
}
