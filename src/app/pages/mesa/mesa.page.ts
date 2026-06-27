import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { SupabaseService } from '../../services/supabase';
import { PushNotification } from '../../services/push-notifications';

interface ItemPedido {
  producto: any;
  cantidad: number;
}

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
  segmentoActivo: 'platos' | 'bebidas' = 'platos';
  encuestaHabilitada: boolean = false;

  itemsPedido: ItemPedido[] = [];
  pedidoExistenteId: string | null = null;
  esModificacion = false;

  productoDetalle: any = null;
  mostrarPanelPedido: boolean = false;

  private cargandoDatos = false;
  hayProblemaDeRed: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabaseService: SupabaseService,
    private pushNotification: PushNotification,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private alertController: AlertController
  ) {}

  async ngOnInit() {
    this.mesaId = this.route.snapshot.paramMap.get('id') || '';
  }

  async ionViewWillEnter() {
    const idActual = this.route.snapshot.paramMap.get('id') || '';
    if (idActual) {
      this.mesaId = idActual;
      await this.cargarDatos();
    }
  }

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

  get puedeEditarPedido(): boolean {
    return !this.pedidoActual || this.pedidoActual.estado === 'rechazado';
  }

  /**
   * Antes esto era un getter recalculado en CADA ciclo de detección de
   * cambios de Angular (porque el HTML lo usa en un *ngFor) — devolvía un
   * array NUEVO cada vez que se lo llamaba, lo cual puede disparar un
   * re-renderizado constante e interminable, sobre todo con imágenes
   * cargando al mismo tiempo (cada imagen que termina de cargar dispara
   * otro chequeo de Angular, que vuelve a pedir el array, que es "nuevo"
   * de nuevo, etc.). Ahora es una propiedad normal que se calcula una
   * sola vez, cuando realmente hace falta (al cargar productos o cambiar
   * de pestaña), no en cada repintado de pantalla.
   */
  paginasProductos: any[][] = [];

  private recalcularPaginasProductos() {
    const lista = this.segmentoActivo === 'platos' ? this.platos : this.bebidas;
    const paginas: any[][] = [];
    for (let i = 0; i < lista.length; i += 2) {
      paginas.push(lista.slice(i, i + 2));
    }
    this.paginasProductos = paginas;
  }

  /**
   * Corre una consulta con un límite de tiempo. Si no responde antes de
   * `ms`, devuelve `fallback` en vez de quedarse esperando para siempre.
   * Esto es lo que evita que la pantalla se cuelgue sin importar la causa
   * de fondo de por qué una consulta puntual no contesta a veces.
   */
  private async conLimiteDeTiempo<T>(promesa: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
    let timeoutId: any;
    const timeoutPromise = new Promise<T>((resolve) => {
      timeoutId = setTimeout(() => resolve(fallback), ms);
    });
    try {
      const resultado = await Promise.race([Promise.resolve(promesa), timeoutPromise]);
      clearTimeout(timeoutId);
      return resultado;
    } catch (e) {
      clearTimeout(timeoutId);
      return fallback;
    }
  }

  async cargarDatos() {
    if (this.cargandoDatos) return;
    this.cargandoDatos = true;
    this.hayProblemaDeRed = false;

    const loading = await this.loadingController.create({
      spinner: 'crescent',
      message: 'Cargando mesa...',
      cssClass: 'spinner-verabri',
    });
    await loading.present();

    try {
      const { data: mesaData, error: errorMesa } = await this.conLimiteDeTiempo(
        this.supabaseService.client.from('mesas').select('*').eq('id', this.mesaId).single(),
        6000,
        { data: null, error: { message: 'timeout' } } as any
      );

      if (errorMesa && !mesaData) {
        this.hayProblemaDeRed = true;
        throw new Error('No se pudo cargar la mesa (red lenta o sin respuesta).');
      }
      this.mesa = mesaData;

      const accesoOk = await this.validarAccesoCliente();
      if (!accesoOk) {
        await loading.dismiss();
        this.cargandoDatos = false;
        return;
      }

      const { data: pedidoData } = await this.conLimiteDeTiempo(
        this.supabaseService.client
          .from('pedidos')
          .select(`*, pedido_items(*, productos(*))`)
          .eq('mesa_id', this.mesaId)
          .neq('estado', 'cerrado')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        6000,
        { data: null } as any
      );

      this.pedidoActual = pedidoData;

      if (this.mesa?.estado === 'vacia') {
        const usuario = this.supabaseService.usuarioActual;
        if (usuario?.perfil === 'cliente_registrado' || usuario?.perfil === 'cliente_anonimo' || this.esAnonimo) {
          await loading.dismiss();
          this.cargandoDatos = false;
          await this.mostrarToast('¡Gracias por tu visita! Hasta pronto.', 'success');
          this.router.navigateByUrl('/home', { replaceUrl: true });
          return;
        }
      }

      if (this.esAnonimo) {
        this.encuestaHabilitada = false;
      } else if (this.pedidoActual && this.pedidoActual.encuesta_realizada === false) {
        this.encuestaHabilitada = true;
      } else {
        this.encuestaHabilitada = false;
      }

      if (this.pedidoActual?.estado === 'rechazado') {
        this.pedidoExistenteId = this.pedidoActual.id;
        this.esModificacion = true;
        this.itemsPedido = (this.pedidoActual.pedido_items || []).map((item: any) => ({
          producto: item.productos,
          cantidad: item.cantidad
        }));
      } else {
        this.pedidoExistenteId = null;
        this.esModificacion = false;
        if (this.pedidoActual?.estado !== undefined && this.pedidoActual !== null) {
          this.itemsPedido = [];
        }
      }

      const { data: productosData, error: errorProductos } = await this.conLimiteDeTiempo(
        this.supabaseService.client
          .from('productos')
          .select('*')
          .eq('activo', true)
          .order('nombre', { ascending: true }),
        6000,
        { data: null, error: { message: 'timeout' } } as any
      );

      if (errorProductos && !productosData) {
        this.hayProblemaDeRed = true;
        this.platos = [];
        this.bebidas = [];
      } else {
        this.platos = (productosData || []).filter((p: any) => p.tipo === 'plato');
        this.bebidas = (productosData || []).filter((p: any) => p.tipo === 'bebida');
      }
      this.recalcularPaginasProductos();

    } catch (error: any) {
      console.error('Error:', error);
      this.hayProblemaDeRed = true;
      await this.mostrarToast('Hubo un problema de conexión. Tocá para reintentar.', 'danger');
    } finally {
      await loading.dismiss();
      this.cargando = false;
      this.cargandoDatos = false;
    }
  }

  async reintentar() {
    await this.cargarDatos();
  }

  async validarAccesoCliente(): Promise<boolean> {
    const usuario = this.supabaseService.usuarioActual;

    const sesionAnonimaRaw = localStorage.getItem('sesion_anonima');
    if (sesionAnonimaRaw) {
      try {
        const sesionAnonima = JSON.parse(sesionAnonimaRaw);
        if (Date.now() > sesionAnonima.expira) {
          localStorage.removeItem('sesion_anonima');
          await this.mostrarPopupAcceso('Sesión vencida', 'Tu sesión expiró. Volvé a ingresar.');
          this.router.navigateByUrl('/home', { replaceUrl: true });
          return false;
        } else {
          if (this.mesa?.cliente_id === sesionAnonima.cliente_id) {
            return true;
          } else {
            await this.mostrarPopupAcceso('Mesa no disponible', 'Esta mesa no está asignada a vos.');
            this.router.navigateByUrl('/home', { replaceUrl: true });
            return false;
          }
        }
      } catch (e) {
        localStorage.removeItem('sesion_anonima');
      }
    }

    if (!usuario) return true;

    const perfil = usuario.perfil;
    const esCliente = perfil === 'cliente_registrado' || perfil === 'cliente_anonimo';
    if (!esCliente) return true;

    if (this.mesa?.cliente_id !== usuario.id) {
      await this.mostrarPopupAcceso('Mesa no disponible', 'Esta mesa no está asignada a vos. Esperá a que el metre te asigne una.');
      this.router.navigateByUrl('/home', { replaceUrl: true });
      return false;
    }

    return true;
  }

  async mostrarPopupAcceso(titulo: string, mensaje: string) {
    const alert = await this.alertController.create({
      header: titulo,
      message: mensaje,
      cssClass: 'alerta-verabri',
      buttons: ['Entendido']
    });
    await alert.present();
  }

  getCantidad(productoId: string): number {
    const item = this.itemsPedido.find(i => i.producto.id === productoId);
    return item ? item.cantidad : 0;
  }

  agregarProducto(producto: any) {
    if (!this.puedeEditarPedido) return;
    const item = this.itemsPedido.find(i => i.producto.id === producto.id);
    if (item) {
      item.cantidad++;
    } else {
      this.itemsPedido.push({ producto, cantidad: 1 });
    }
  }

  quitarProducto(producto: any) {
    if (!this.puedeEditarPedido) return;
    const index = this.itemsPedido.findIndex(i => i.producto.id === producto.id);
    if (index !== -1) {
      if (this.itemsPedido[index].cantidad > 1) {
        this.itemsPedido[index].cantidad--;
      } else {
        this.itemsPedido.splice(index, 1);
      }
    }
  }

  get totalPedido(): number {
    return this.itemsPedido.reduce((total, item) => {
      return total + (item.producto.precio * item.cantidad);
    }, 0);
  }

  get tiempoEstimado(): number {
    if (this.itemsPedido.length === 0) return 0;
    return Math.max(...this.itemsPedido.map(item => item.producto.tiempo_min || 0));
  }

  get cantidadItems(): number {
    return this.itemsPedido.reduce((total, item) => total + item.cantidad, 0);
  }

  obtenerClienteId(): string {
    const sesionAnonimaRaw = localStorage.getItem('sesion_anonima');
    if (sesionAnonimaRaw) {
      try {
        const sesionAnonima = JSON.parse(sesionAnonimaRaw);
        if (Date.now() < sesionAnonima.expira) {
          return sesionAnonima.cliente_id;
        }
      } catch (e) {}
    }
    return this.supabaseService.usuarioActual?.id || '00000000-0000-0000-0000-000000000000';
  }

  async confirmarPedido() {
    if (this.itemsPedido.length === 0) {
      await this.supabaseService.vibrarError();
      await this.mostrarToast('Seleccioná al menos un producto.', 'warning');
      return;
    }

    const loading = await this.loadingController.create({
      spinner: 'crescent',
      message: this.esModificacion ? 'Actualizando pedido...' : 'Enviando pedido...',
      cssClass: 'spinner-verabri',
    });
    await loading.present();

    try {
      let pedidoId = this.pedidoExistenteId;

      if (this.esModificacion && pedidoId) {
        await this.supabaseService.client
          .from('pedidos')
          .update({ estado: 'pendiente', subtotal: this.totalPedido, total: this.totalPedido })
          .eq('id', pedidoId);

        await this.supabaseService.client
          .from('pedido_items')
          .delete()
          .eq('pedido_id', pedidoId);

      } else {
        const { data: pedidoData, error: errorPedido } = await this.supabaseService.client
          .from('pedidos')
          .insert({
            mesa_id: this.mesaId,
            cliente_id: this.obtenerClienteId(),
            estado: 'pendiente',
            subtotal: this.totalPedido,
            total: this.totalPedido
          })
          .select()
          .single();

        if (errorPedido) throw errorPedido;
        pedidoId = pedidoData.id;
      }

      const items = this.itemsPedido.map(item => ({
        pedido_id: pedidoId,
        producto_id: item.producto.id,
        cantidad: item.cantidad,
        precio_unit: item.producto.precio
      }));

      const { error: errorItems } = await this.supabaseService.client
        .from('pedido_items')
        .insert(items);

      if (errorItems) throw errorItems;

      try {
        await this.pushNotification.enviarPushNotificationAUsuario(
          '🍽️ Nuevo pedido',
          `La mesa ${this.mesa?.numero} realizó un pedido. ¡Revisalo!`,
          'mozo@verabri.com'
        );
      } catch (pushError) {
        console.warn('No se pudo enviar la push notification:', pushError);
      }

      await this.mostrarToast(
        this.esModificacion ? '¡Pedido actualizado!' : '¡Pedido enviado! El mozo lo confirmará pronto.',
        'success'
      );

      this.itemsPedido = [];
      await this.cargarDatos();

    } catch (error: any) {
      console.error('Error:', error);
      await this.mostrarToast('No se pudo enviar el pedido.', 'danger');
    } finally {
      await loading.dismiss();
    }
  }

  abrirDetalle(producto: any) {
    this.productoDetalle = producto;
  }

  cerrarDetalle() {
    this.productoDetalle = null;
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

  cambiarSegmento(evento: any) {
    this.segmentoActivo = evento.detail.value;
    this.recalcularPaginasProductos();
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
    if (p.cocina_listo) return '🍽️ Platos listos — bar en preparación';
    if (p.bar_listo) return '🥤 Bebidas listas — cocina en preparación';
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
      'rechazado': '⚠️ Pedido rechazado — modificalo abajo',
      'recibido': '✅ ¡Recibido! Que lo disfrutes.',
      'pagado': '✅ Pagado',
      'cerrado': '✅ Pagado',
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