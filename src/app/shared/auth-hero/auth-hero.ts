import { Component, input } from '@angular/core';
import { Icon } from '../icon/icon';

// Green animated side panel shared by the login and register pages.
@Component({
  selector: 'aside[app-auth-hero]',
  imports: [Icon],
  templateUrl: './auth-hero.html',
  host: { class: 'auth-hero', 'aria-hidden': 'true' },
})
export class AuthHero {
  heading = input('Seu estoque sob controle, de ponta a ponta.');
  text = input(
    'Produtos, fornecedores, filiais e movimentações em um só lugar — simples, rápido e sempre atualizado.',
  );
}
