import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { SupabaseService } from '../../services/supabase';

interface Pregunta {
  texto: string;
  opciones: string[];
  correcta: number;
}

@Component({
  standalone: false,
  selector: 'app-juego-trivia',
  templateUrl: './juego-trivia.page.html',
  styleUrls: ['./juego-trivia.page.scss'],
})
export class JuegoTriviaPage implements OnInit {

  mesaId: string = '';
  pedidoId: string = '';
  yaJugoAntes = false;

  preguntas: Pregunta[] = [
    {
      texto: '¿Cuál es el ingrediente principal de la milanesa?',
      opciones: ['Pollo', 'Carne vacuna', 'Cerdo', 'Pescado'],
      correcta: 1
    },
    {
      texto: '¿En qué país se originó el asado?',
      opciones: ['Brasil', 'Chile', 'Argentina', 'Uruguay'],
      correcta: 2
    },
    {
      texto: '¿Qué vino se recomienda con carnes rojas?',
      opciones: ['Chardonnay', 'Sauvignon Blanc', 'Malbec', 'Rosé'],
      correcta: 2
    },
    {
      texto: '¿Cuánto tiempo promedio tarda en cocinarse un bife de chorizo?',
      opciones: ['2 minutos', '5 minutos', '15 minutos', '45 minutos'],
      correcta: 2
    },
    {
      texto: '¿Qué corte de carne es el más tierno?',
      opciones: ['Asado', 'Lomo', 'Vacío', 'Matambre'],
      correcta: 1
    }
  ];

  preguntaActual = 0;
  respuestaSeleccionada: number | null = null;
  respondido = false;
  correctas = 0;
  juegoTerminado = false;
  gano = false;
  primerIntento = true;
  descuento = 10;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private toastController: ToastController,
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

    if (data?.juegos_jugados?.includes('trivia')) {
      this.yaJugoAntes = true;
      this.primerIntento = false;
    }
  }

  seleccionarRespuesta(index: number) {
    if (this.respondido) return;

    this.respuestaSeleccionada = index;
    this.respondido = true;

    if (index === this.preguntas[this.preguntaActual].correcta) {
      this.correctas++;
    } else {
      this.primerIntento = false;
    }

    setTimeout(() => {
      if (this.preguntaActual < this.preguntas.length - 1) {
        this.preguntaActual++;
        this.respuestaSeleccionada = null;
        this.respondido = false;
      } else {
        this.terminarJuego();
      }
    }, 1000);
  }

  async terminarJuego() {
    this.juegoTerminado = true;
    this.gano = this.correctas === this.preguntas.length && this.primerIntento && !this.yaJugoAntes;

    // Marcar que ya jugó este juego
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
      if (!jugados.includes('trivia')) {
        await this.supabaseService.client
          .from('pedidos')
          .update({ juegos_jugados: [...jugados, 'trivia'] })
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
        .select('descuento_pct, total, subtotal')
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

  esCorrecta(index: number): boolean {
    return index === this.preguntas[this.preguntaActual].correcta;
  }

  esIncorrecta(index: number): boolean {
    return this.respondido && index === this.respuestaSeleccionada && index !== this.preguntas[this.preguntaActual].correcta;
  }

  get progreso(): number {
    return ((this.preguntaActual + 1) / this.preguntas.length) * 100;
  }

  volver() {
    this.router.navigateByUrl(`/juegos/${this.mesaId}`);
  }
}