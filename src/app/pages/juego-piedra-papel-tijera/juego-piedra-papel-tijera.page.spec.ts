import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';

type Opcion = 'piedra' | 'papel' | 'tijera';

@Component({
  standalone: false,
  selector: 'app-juego-piedra-papel-tijera',
  templateUrl: './juego-piedra-papel-tijera.page.html',
  styleUrls: ['./juego-piedra-papel-tijera.page.scss'],
})
export class JuegoPiedraPapelTijeraPage implements OnInit {

  mesaId: string = '';
  pedidoId: string = '';
  yaJugoAntes = false;

  opciones: Opcion[] = ['piedra', 'papel', 'tijera'];
  emojis: Record<Opcion, string> = {
    piedra: '🪨',
    papel: '📄',
    tijera: '✂️'
  };

  rondaActual = 1;
  totalRondas = 3;
  victorias = 0;
  derrotas = 0;

  eleccionJugador: Opcion | null = null;
  eleccionMaquina: Opcion | null = null;
  resultadoRonda: 'ganaste' | 'perdiste' | 'empate' | null = null;

  juegoTerminado = false;
  gano = false;
  animando = false;
  descuento = 20;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabaseService: SupabaseService
  ) {}

  async ngOnInit() {
    this.mesaId = this.route.snapshot.paramMap.get('mesaId') || '';
    this.pedidoId = this.route.snapshot.paramMap.get('pedidoId') || '';
    await this.verificarPrimerIntento();
  }

  async verificarPrimerIntento() {
    if (!this.pedidoId) return;
    const { data } = await this.supabaseService.client
      .from('pedidos')
      .select('juegos_jugados')
      .eq('id', this.pedidoId)
      .single();

    if (data?.juegos_jugados?.includes('ppt')) {
      this.yaJugoAntes = true;
    }
  }

  elegir(opcion: Opcion) {
    if (this.animando || this.juegoTerminado) return;

    this.animando = true;
    this.eleccionJugador = opcion;
    this.eleccionMaquina = null;
    this.resultadoRonda = null;

    setTimeout(() => {
      const indexMaquina = Math.floor(Math.random() * 3);
      this.eleccionMaquina = this.opciones[indexMaquina];
      this.resultadoRonda = this.calcularResultado(opcion, this.eleccionMaquina);

      if (this.resultadoRonda === 'ganaste') this.victorias++;
      else if (this.resultadoRonda === 'perdiste') this.derrotas++;

      this.animando = false;

      if (this.rondaActual === this.totalRondas || this.victorias === 2 || this.derrotas === 2) {
        setTimeout(() => this.terminarJuego(), 1200);
      } else {
        setTimeout(() => {
          this.rondaActual++;
          this.eleccionJugador = null;
          this.eleccionMaquina = null;
          this.resultadoRonda = null;
        }, 1200);
      }
    }, 800);
  }

  calcularResultado(jugador: Opcion, maquina: Opcion): 'ganaste' | 'perdiste' | 'empate' {
    if (jugador === maquina) return 'empate';
    if (
      (jugador === 'piedra' && maquina === 'tijera') ||
      (jugador === 'papel' && maquina === 'piedra') ||
      (jugador === 'tijera' && maquina === 'papel')
    ) return 'ganaste';
    return 'perdiste';
  }

  async terminarJuego() {
    this.juegoTerminado = true;
    this.gano = this.victorias > this.derrotas && !this.yaJugoAntes;

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
      if (!jugados.includes('ppt')) {
        await this.supabaseService.client
          .from('pedidos')
          .update({ juegos_jugados: [...jugados, 'ppt'] })
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

  getColorResultado(): string {
    if (this.resultadoRonda === 'ganaste') return 'success';
    if (this.resultadoRonda === 'perdiste') return 'danger';
    return 'warning';
  }

  getTextoResultado(): string {
    if (this.resultadoRonda === 'ganaste') return '¡Ganaste la ronda!';
    if (this.resultadoRonda === 'perdiste') return 'Perdiste la ronda';
    return 'Empate';
  }

  volver() {
    this.router.navigateByUrl(`/juegos/${this.mesaId}`);
  }
}