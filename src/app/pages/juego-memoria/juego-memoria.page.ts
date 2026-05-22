import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';

interface Carta {
  id: number;
  emoji: string;
  volteada: boolean;
  encontrada: boolean;
}

@Component({
  standalone: false,
  selector: 'app-juego-memoria',
  templateUrl: './juego-memoria.page.html',
  styleUrls: ['./juego-memoria.page.scss'],
})
export class JuegoMemoriaPage implements OnInit {

  mesaId: string = '';
  pedidoId: string = '';
  yaJugoAntes = false;

  cartas: Carta[] = [];
  cartasVolteadas: Carta[] = [];
  parejas = 0;
  totalParejas = 6;
  intentos = 0;
  juegoTerminado = false;
  gano = false;
  bloqueado = false;
  descuento = 15;

  emojis = ['🍕', '🍔', '🍣', '🥩', '🍷', '🍰'];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabaseService: SupabaseService
  ) {}

  async ngOnInit() {
    this.mesaId = this.route.snapshot.paramMap.get('mesaId') || '';
    this.pedidoId = this.route.snapshot.paramMap.get('pedidoId') || '';
    await this.verificarPrimerIntento();
    this.iniciarJuego();
  }

  async verificarPrimerIntento() {
    if (!this.pedidoId) return;
    const { data } = await this.supabaseService.client
      .from('pedidos')
      .select('juegos_jugados')
      .eq('id', this.pedidoId)
      .single();

    if (data?.juegos_jugados?.includes('memoria')) {
      this.yaJugoAntes = true;
    }
  }

  iniciarJuego() {
    const pares = [...this.emojis, ...this.emojis];
    this.cartas = pares
      .map((emoji, index) => ({
        id: index,
        emoji,
        volteada: false,
        encontrada: false
      }))
      .sort(() => Math.random() - 0.5);

    this.cartasVolteadas = [];
    this.parejas = 0;
    this.intentos = 0;
    this.juegoTerminado = false;
    this.gano = false;
    this.bloqueado = false;
  }

  voltearCarta(carta: Carta) {
    if (this.bloqueado || carta.volteada || carta.encontrada) return;

    carta.volteada = true;
    this.cartasVolteadas.push(carta);

    if (this.cartasVolteadas.length === 2) {
      this.intentos++;
      this.bloqueado = true;

      const [c1, c2] = this.cartasVolteadas;

      if (c1.emoji === c2.emoji) {
        c1.encontrada = true;
        c2.encontrada = true;
        this.parejas++;
        this.cartasVolteadas = [];
        this.bloqueado = false;

        if (this.parejas === this.totalParejas) {
          this.terminarJuego();
        }
      } else {
        setTimeout(() => {
          c1.volteada = false;
          c2.volteada = false;
          this.cartasVolteadas = [];
          this.bloqueado = false;
        }, 1000);
      }
    }
  }

  async terminarJuego() {
    this.juegoTerminado = true;
    this.gano = this.intentos === this.totalParejas && !this.yaJugoAntes;

    await this.marcarJugado();

    if (this.gano && this.pedidoId) {
      await this.aplicarDescuento();
    }
  }

  async marcarJugado() {
    if (!this.pedidoId || this.yaJugoAntes) return;
    try {
      const { data } = await this.supabaseService.client
        .from('pedidos')
        .select('juegos_jugados')
        .eq('id', this.pedidoId)
        .single();

      const jugados = data?.juegos_jugados || [];
      if (!jugados.includes('memoria')) {
        await this.supabaseService.client
          .from('pedidos')
          .update({ juegos_jugados: [...jugados, 'memoria'] })
          .eq('id', this.pedidoId);
      }
    } catch (error) {
      console.error('Error al marcar juego:', error);
    }
  }

  async aplicarDescuento() {
    try {
      const { data: pedido } = await this.supabaseService.client
        .from('pedidos')
        .select('descuento_pct, subtotal')
        .eq('id', this.pedidoId)
        .single();

      if (pedido && pedido.descuento_pct > 0) return;

      const subtotal = pedido?.subtotal || 0;
      const nuevoTotal = subtotal * (1 - this.descuento / 100);

      await this.supabaseService.client
        .from('pedidos')
        .update({
          descuento_pct: this.descuento,
          total: nuevoTotal
        })
        .eq('id', this.pedidoId);

    } catch (error) {
      console.error('Error al aplicar descuento:', error);
    }
  }

  volver() {
    this.router.navigateByUrl(`/juegos/${this.mesaId}`);
  }
}