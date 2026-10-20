import { Component, PLATFORM_ID, computed, inject, input, output, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../../core/services/auth';
import { Icon } from '../../shared/icon/icon';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
}

// Grupo que abre/fecha no menu (ex.: Cadastros).
interface MenuGroup {
  id: string;
  label: string;
  icon: string;
  children: MenuItem[];
}

type MenuEntry = MenuItem | MenuGroup;

const GROUPS_STORAGE_KEY = 'estoque-facil.menu-groups';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, Icon],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  collapsed = input(false);
  navigate = output<void>();

  readonly menu: MenuEntry[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    { label: 'Estoque', icon: 'estoque', route: '/estoque' },
    { label: 'Compras (SC)', icon: 'compras', route: '/compras' },
    {
      id: 'cadastros',
      label: 'Cadastros',
      icon: 'cadastros',
      children: [
        { label: 'Produtos', icon: 'produtos', route: '/produtos' },
        { label: 'Categorias', icon: 'categorias', route: '/categorias' },
        { label: 'Filiais', icon: 'building', route: '/filiais' },
        { label: 'Fornecedores', icon: 'fornecedores', route: '/fornecedores' },
        { label: 'Setores', icon: 'setores', route: '/setores' },
      ],
    },
    { label: 'Relatórios', icon: 'relatorios', route: '/relatorios' },
    { label: 'Configurações', icon: 'configuracoes', route: '/configuracoes' },
  ];

  // Visível só para o dono da plataforma (super admin).
  readonly platformItems: MenuItem[] = [
    { label: 'Empresas', icon: 'building', route: '/empresas' },
    { label: 'Planos', icon: 'relatorios', route: '/planos' },
  ];

  readonly isSuperAdmin = inject(AuthService).isSuperAdmin;

  // Grupos que o usuário abriu ou fechou (lembrado entre visitas).
  private readonly toggled = signal<Record<string, boolean>>(this.readToggled());

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  // Grupo que contém a página atual: fica destacado e abre sozinho.
  protected readonly activeGroupId = computed(() => {
    const url = this.currentUrl();
    const group = this.menu.find(
      (entry): entry is MenuGroup => this.isGroup(entry) && entry.children.some((child) => url.startsWith(child.route)),
    );
    return group?.id ?? null;
  });

  protected isGroup(entry: MenuEntry): entry is MenuGroup {
    return 'children' in entry;
  }

  protected asGroup(entry: MenuEntry): MenuGroup {
    return entry as MenuGroup;
  }

  protected asItem(entry: MenuEntry): MenuItem {
    return entry as MenuItem;
  }

  protected isOpen(group: MenuGroup): boolean {
    return this.toggled()[group.id] ?? this.activeGroupId() === group.id;
  }

  protected toggle(group: MenuGroup): void {
    const next = { ...this.toggled(), [group.id]: !this.isOpen(group) };
    this.toggled.set(next);
    if (this.isBrowser) {
      try {
        localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Sem armazenamento disponível: só não lembra a preferência.
      }
    }
  }

  private readToggled(): Record<string, boolean> {
    if (!this.isBrowser) {
      return {};
    }
    try {
      return JSON.parse(localStorage.getItem(GROUPS_STORAGE_KEY) ?? '{}');
    } catch {
      return {};
    }
  }
}
