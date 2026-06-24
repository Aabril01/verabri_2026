import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';

@Component({
  standalone: false,
  selector: 'app-juegos',
  templateUrl: './juegos.page.html',
  styleUrls: ['./juegos.page.scss'],
})
export class JuegosPage implements OnInit {

  mesaId: string = '';
  pedidoId: string = '';
  tieneDescuento = false;

  juegos = [
    {
      nombre: 'Trivia',
      descripcion: 'Respondé 5 preguntas sin errores',
      emoji: '🧠',
      descuento: 10,
      clave: 'trivia'
    },
    {
      nombre: 'Juego de Memoria',
      descripcion: 'Encontrá todos los pares de cartas sin equivocarte',
      emoji: '🃏',
      descuento: 15,
      clave: 'memoria'
    },
    {
      nombre: 'Piedra Papel Tijera',
      descripcion: 'Ganá 2 de 3 rondas contra la máquina',
      emoji: '✂️',
      descuento: 20,
      clave: 'ppt'
    }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabaseService: SupabaseService
  ) {}

  /**
   * El cliente anónimo NUNCA tiene usuarioActual seteado (no pasa por
   * Supabase Auth) — su identidad vive únicamente en localStorage
   * ('sesion_anonima'). El chequeo anterior comparaba
   * usuarioActual?.perfil === 'cliente_anonimo', que para un anónimo real
   * siempre es undefined === 'cliente_anonimo' (false), así que el guard
   * nunca se disparaba y cualquier anónimo podía entrar a jugar.
   */
  get esAnonimo(): boolean {
    const sesionAnonimaRaw = localStorage.getItem('sesion_anonima');
    if (!sesionAnonimaRaw) return false;
    try {
      const sesionAnonima = JSON.parse(sesionAnonimaRaw);
      return Date.now() < sesionAnonima.expira;
    } catch (e) {
      return false;
    }
  }

  async ngOnInit() {
    this.mesaId = this.route.snapshot.paramMap.get('mesaId') || '';

    if (this.esAnonimo) {
      this.router.navigateByUrl('/home', { replaceUrl: true });
      return;
    }

    await this.cargarPedido();
  }

  async cargarPedido() {
    const { data, error } = await this.supabaseService.client
      .from('pedidos')
      .select('id, descuento_pct')
      .eq('mesa_id', this.mesaId)
      .not('estado', 'in', '("pendiente","rechazado","pagado")')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

      console.log('Pedido data:', data);
      console.log('Pedido error:', error);

    if (data) {
      this.pedidoId = data.id;
      this.tieneDescuento = data.descuento_pct > 0;
    }
  }

  irAlJuego(clave: string) {
      console.log('mesaId:', this.mesaId);
      console.log('pedidoId:', this.pedidoId);
    this.router.navigateByUrl(`/juego-${clave === 'ppt' ? 'piedra-papel-tijera' : clave}/${this.mesaId}/${this.pedidoId}`);
  }
}