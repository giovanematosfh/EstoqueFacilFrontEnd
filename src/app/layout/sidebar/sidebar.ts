import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Icon } from '../../shared/icon/icon';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, Icon],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  collapsed = input(false);
  navigate = output<void>();

  readonly menuItems: MenuItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    { label: 'Produtos', icon: 'produtos', route: '/produtos' },
    { label: 'Categorias', icon: 'categorias', route: '/categorias' },
    { label: 'Estoque', icon: 'estoque', route: '/estoque' },
    { label: 'Filiais', icon: 'building', route: '/filiais' },
    { label: 'Fornecedores', icon: 'fornecedores', route: '/fornecedores' },
    { label: 'Relatórios', icon: 'relatorios', route: '/relatorios' },
    { label: 'Configurações', icon: 'configuracoes', route: '/configuracoes' },
  ];
}
