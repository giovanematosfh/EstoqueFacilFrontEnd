import { Component, afterNextRender, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';

const MOBILE_BREAKPOINT = 900;

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar, Topbar],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  protected readonly collapsed = signal(false);

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
