import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { SupabaseService } from '../../services/supabase';

@Component({
  standalone: false,
  selector: 'app-mesa',
  templateUrl: './mesa.page.html',
  styleUrls: ['./mesa.page.scss'],
})
export class MesaPage implements OnInit {

  mesaId: string = '';
  mesa: any = null;
  platos: any[] = [];
  bebidas: any[] = [];
  pedidoActual: any = null;
  cargando = true;
  segmentoActivo: 'info' | 'platos' | 'bebidas' = 'info';
  encuestaHabilitada: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabaseService: SupabaseService,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    this.mesaId = this.route.snapshot.paramMap.get('id') || '';
    await this.cargarDatos();
  }

  async ionViewWillEnter() {
    if (this.mesaId) {
      await this.cargarDatos();
    }
  }

  async cargarDatos() {
    const loading = await this.loadingController.create({
      spinner: 'crescent',
      message: 'Cargando mesa...',
      cssClass: 'spinner-verabri',
    });
    await loading.present();

    try {
      const { data: mesaData, error: errorMesa } = await this.supabaseService.client
        .from('mesas')
        .select('*')
        .eq('id', this.mesaId)
        .single();

      if (errorMesa) throw errorMesa;
      this.mesa = mesaData;

      await this.validarAccesoCliente();

      const { data: pedidoData } = await this.supabaseService.client
        .from('pedidos')
        .select(`*, pedido_items(*, productos(nombre, precio, tiempo_min))`)
        .eq('mesa_id', this.mesaId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      this.pedidoActual = pedidoData;

      // Si el pedido fue pagado, redirigir al cliente al home
      if (this.mesa?.estado === 'vacia') {
        const usuario = this.supabaseService.usuarioActual;
        if (usuario?.perfil === 'cliente_registrado' || usuario?.perfil === 'cliente_anonimo') {
          await loading.dismiss();
          await this.mostrarToast('¡Gracias por tu visita! Hasta pronto.', 'success');
          this.router.navigateByUrl('/home', { replaceUrl: true });
          return;
        }
      }

      if (this.pedidoActual && this.pedidoActual.encuesta_realizada === false) {
        this.encuestaHabilitada = true;
      } else {
        this.encuestaHabilitada = false;
      }

      const { data: productosData, error: errorProductos } = await this.supabaseService.client
        .from('productos')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (errorProductos) throw errorProductos;

      this.platos = (productosData || []).filter((p: any) => p.tipo === 'plato');
      this.bebidas = (productosData || []).filter((p: any) => p.tipo === 'bebida');

    } catch (error: any) {
      console.error('Error:', error);
      await this.mostrarToast('Error al cargar la mesa.', 'danger');
    } finally {
      await loading.dismiss();
      this.cargando = false;
    }
  }


  async validarAccesoCliente() {
    const usuario = this.supabaseService.usuarioActual;
    if (!usuario) return;

    const perfil = usuario.perfil;
    const esCliente = perfil === 'cliente_registrado' || perfil === 'cliente_anonimo';
    if (!esCliente) return;

    if (this.mesa?.cliente_id !== usuario.id) {
      await this.mostrarToast('Esta mesa no está asignada a vos. Esperá a que el metre te asigne una.', 'warning');
      this.router.navigateByUrl('/home', { replaceUrl: true });
    }
  }

  async confirmarRecepcion() {
    try {
      await this.supabaseService.client
        .from('pedidos')
        .update({ estado: 'recibido' })
        .eq('id', this.pedidoActual.id);

      await this.mostrarToast('¡Recepción confirmada! Ya podés pedir la cuenta.', 'success');
      await this.cargarDatos();
    } catch (error) {
      console.error('Error:', error);
    }
  }

  pedirCuenta() {}

  cambiarSegmento(evento: any) {
    this.segmentoActivo = evento.detail.value;
  }

  formatearTipo(tipo: string): string {
    const tipos: any = {
      'vip': 'VIP',
      'estandar': 'Estándar',
      'movilidad_reducida': 'Movilidad reducida'
    };
    return tipos[tipo] || tipo;
  }

  getEstadoPreparacion(): string {
    const p = this.pedidoActual;
    if (p.cocina_listo && p.bar_listo) return '✅ Todo listo — esperando al mozo';
    if (p.cocina_listo) return '🍽️ Cocina lista — bar en preparación';
    if (p.bar_listo) return '🥤 Bar listo — cocina en preparación';
    return '🔄 En preparación (cocina y bar)';
  }

  getEstadoPedido(): string {
    if (!this.pedidoActual) return '';
    const estados: any = {
      'pendiente': 'Esperando confirmación del mozo',
      'confirmado': this.getEstadoPreparacion(),
      'en_cocina': 'En cocina',
      'en_bar': 'En bar',
      'listo': '✅ ¡Pedido listo! El mozo lo llevará pronto',
      'entregado': '🚀 ¡En camino!',
      'rechazado': '⚠️ Pedido rechazado — podés modificarlo',
      'recibido': '✅ ¡Recibido! Que lo disfrutes.',
    };
    return estados[this.pedidoActual.estado] || this.pedidoActual.estado;
  }

  getColorEstado(): string {
    if (!this.pedidoActual) return 'medium';
    const colores: any = {
      'pendiente': 'warning',
      'confirmado': 'primary',
      'en_cocina': 'tertiary',
      'en_bar': 'tertiary',
      'listo': 'success',
      'entregado': 'success',
      'rechazado': 'danger',
      'recibido': 'success',
    };
    return colores[this.pedidoActual.estado] || 'medium';
  }

  irAlChat() {
    this.router.navigateByUrl(`/chat/${this.mesaId}`);
  }

  irAlPedido() {
    this.router.navigateByUrl(`/pedido/${this.mesaId}`);
  }

  irAEncuesta() {
    this.router.navigateByUrl(`/encuesta/${this.pedidoActual.id}/${this.mesa.cliente_id}/${this.mesaId}`);
  }

  irAEstadistica() {
    this.router.navigateByUrl(`/estadistica/menu`);
  }

  async mostrarToast(mensaje: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 2500,
      position: 'top',
      color,
      icon: color === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline'
    });
    await toast.present();
  }

  get usuarioActual() {
    return this.supabaseService.usuarioActual;
  }
}