import { Routes } from '@angular/router';
import { authGuard, guestGuard, superAdminGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
    title: 'Entrar',
  },
  {
    path: 'confirm-email',
    loadComponent: () => import('./pages/confirm-email/confirm-email').then((m) => m.ConfirmEmail),
    title: 'Confirmar e-mail',
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
        title: 'Dashboard',
      },
      {
        path: 'produtos',
        loadComponent: () => import('./pages/produtos/produtos').then((m) => m.Produtos),
        title: 'Produtos',
      },
      {
        path: 'categorias',
        loadComponent: () => import('./pages/categorias/categorias').then((m) => m.Categorias),
        title: 'Categorias',
      },
      {
        path: 'estoque',
        loadComponent: () => import('./pages/estoque/estoque').then((m) => m.Estoque),
        title: 'Estoque',
      },
      {
        path: 'compras',
        loadComponent: () => import('./pages/compras/compras').then((m) => m.Compras),
        title: 'Solicitações de Compra',
      },
      {
        path: 'filiais',
        loadComponent: () => import('./pages/filiais/filiais').then((m) => m.Filiais),
        title: 'Filiais',
      },
      {
        path: 'fornecedores',
        loadComponent: () => import('./pages/fornecedores/fornecedores').then((m) => m.Fornecedores),
        title: 'Fornecedores',
      },
      {
        path: 'setores',
        loadComponent: () => import('./pages/setores/setores').then((m) => m.Setores),
        title: 'Setores',
      },
      {
        path: 'relatorios',
        loadComponent: () => import('./pages/relatorios/relatorios').then((m) => m.Relatorios),
        title: 'Relatórios',
      },
      {
        path: 'configuracoes',
        loadComponent: () => import('./pages/configuracoes/configuracoes').then((m) => m.Configuracoes),
        title: 'Configurações',
      },
      {
        path: 'empresas',
        canActivate: [superAdminGuard],
        loadComponent: () => import('./pages/empresas/empresas').then((m) => m.Empresas),
        title: 'Empresas',
      },
      {
        path: 'planos',
        canActivate: [superAdminGuard],
        loadComponent: () => import('./pages/planos/planos').then((m) => m.Planos),
        title: 'Planos',
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
