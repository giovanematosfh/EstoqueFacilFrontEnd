import { Component } from '@angular/core';

interface StatCard {
  label: string;
  value: string;
  warning?: boolean;
}

interface Movimentacao {
  produto: string;
  tipo: 'entrada' | 'saida';
  quantidade: number;
  data: string;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  readonly stats: StatCard[] = [
    { label: 'Total de Produtos', value: '1.248' },
    { label: 'Estoque Baixo', value: '12', warning: true },
    { label: 'Valor em Estoque', value: 'R$ 184.320,00' },
    { label: 'Movimentações Hoje', value: '37' },
  ];

  readonly movimentacoes: Movimentacao[] = [
    { produto: 'Parafuso Sextavado M8', tipo: 'entrada', quantidade: 500, data: '07/08/2026 09:12' },
    { produto: 'Luva de Proteção G', tipo: 'saida', quantidade: 24, data: '07/08/2026 08:45' },
    { produto: 'Cabo de Rede Cat6 (metro)', tipo: 'entrada', quantidade: 300, data: '06/08/2026 17:30' },
    { produto: 'Fita Isolante Preta', tipo: 'saida', quantidade: 60, data: '06/08/2026 15:02' },
  ];
}
