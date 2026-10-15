import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth';
import { Icon } from '../../shared/icon/icon';
import { Footer } from '../footer/footer';
import { Sidebar } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';

const MOBILE_BREAKPOINT = 900;
const DUE_WARNING_DAYS = 7;

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar, Topbar, Footer, Icon],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  private readonly auth = inject(AuthService);

  protected readonly collapsed = signal(false);

  // Avisa o admin da empresa quando a assinatura está perto de vencer.
  protected readonly dueWarning = computed(() => {
    const user = this.auth.currentUser();
    if (!user?.companyDueDate || user.isSuperAdmin || user.role !== 'Admin') {
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(`${user.companyDueDate}T00:00:00`);
    const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);

    if (days < 0 || days > DUE_WARNING_DAYS) {
      return null;
    }

    const when = days === 0 ? 'hoje' : days === 1 ? 'amanhã' : `em ${days} dias`;
    return `A assinatura da sua empresa vence ${when} (${due.toLocaleDateString('pt-BR')}). Renove para não perder o acesso.`;
  });

  constructor() {
    afterNextRender(() => {
      if (window.innerWidth < MOBILE_BREAKPOINT) {
        this.collapsed.set(true);
      }
    });
  }

  protected toggleSidebar(): void {
    this.collapsed.set(!this.collapsed());
  }

  protected onNavigate(): void {
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      this.collapsed.set(true);
    }
  }
}
