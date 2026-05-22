import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { SupabaseService } from '../../services/supabase';
import { PushNotification } from '../../services/push-notifications';
import { addIcons } from 'ionicons';
import { addCircleOutline, removeCircleOutline, timeOutline, cartOutline, checkmarkCircleOutline, flameOutline, wineOutline } from 'ionicons/icons';

interface ItemPedido {
  producto: any;
  cantidad: number;
}

@Component({
  standalone: false,
  selector: 'app-pedido',
  templateUrl: './pedido.page.html',
  styleUrls: ['./pedido.page.scss'],
})
export class PedidoPage implements OnInit {

  mesaId: string = '';
  pedidoExistenteId: string | null = null;
  platos: any[] = [];
  bebidas: any[] = [];
  itemsPedido: ItemPedido[] = [];
  segmentoActivo: 'platos' | 'bebidas' = 'platos';
  cargando = true;
  usuarioActual: any = null;
  esModificacion = false;
  numeroMesa: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabaseService: SupabaseService,
    private pushNotification: PushNotification,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {
    addIcons({
      'add-circle-outline': addCircleOutline,
      'remove-circle-outline': removeCircleOutline,
      'time-outline': timeOutline,
      'cart-outline': cartOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
      'flame-outline': flameOutline,
      'wine-outline': wineOutline
    });
  }

  async ngOnInit() {
    this.mesaId = this.route.snapshot.paramMap.get('mesaId') || '';
    this.usuarioActual = this.supabaseService.usuarioActual;
    await this.cargarProductos();
    await this.cargarPedidoExistente();
    await this.cargarNumeroMesa();
  }

  async ionViewWillEnter() {
    if (this.mesaId) {
      await this.cargarPedidoExistente();
    }
  }

  async cargarNumeroMesa() {
    const { data } = await this.supabaseService.client
      .from('mesas')
      .select('numero')
      .eq('id', this.mesaId)
      .single();
    if (data) this.numeroMesa = data.numero;
  }

  async cargarProductos() {
    const loading = await this.loadingController.create({
      spinner: 'crescent',
      message: 'Cargando menú...',
      cssClass: 'spinner-verabri',
    });
    await loading.present();

    try {
      const { data, error } = await this.supabaseService.client
        .from('productos')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (error) throw error;

      this.platos = (data || []).filter((p: any) => p.tipo === 'plato');
      this.bebidas = (data || []).filter((p: any) => p.tipo === 'bebida');

    } catch (error: any) {
      console.error('Error:', error);
      await this.mostrarToast('Error al cargar el menú.', 'danger');
    } finally {
      await loading.dismiss();
      this.cargando = false;
    }
  }

  async cargarPedidoExistente() {
    try {
      const { data: pedido } = await this.supabaseService.client
        .from('pedidos')
        .select(`*, pedido_items(*, productos(*))`)
        .eq('mesa_id', this.mesaId)
        .in('estado', ['pendiente', 'rechazado'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pedido) {
        this.pedidoExistenteId = pedido.id;
        this.esModificacion = true;

        this.itemsPedido = pedido.pedido_items.map((item: any) => ({
          producto: item.productos,
          cantidad: item.cantidad
        }));
      }
    } catch (error) {
      console.error('Error al cargar pedido existente:', error);
    }
  }

  cambiarSegmento(evento: any) {
    this.segmentoActivo = evento.detail.value;
  }

  getCantidad(productoId: string): number {
    const item = this.itemsPedido.find(i => i.producto.id === productoId);
    return item ? item.cantidad : 0;
  }

  agregarProducto(producto: any) {
    const item = this.itemsPedido.find(i => i.producto.id === producto.id);
    if (item) {
      item.cantidad++;
    } else {
      this.itemsPedido.push({ producto, cantidad: 1 });
    }
  }

  quitarProducto(producto: any) {
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
    return this.itemsPedido.reduce((total, item) => {
      return total + (item.producto.tiempo_min * item.cantidad);
    }, 0);
  }

  get cantidadItems(): number {
    return this.itemsPedido.reduce((total, item) => total + item.cantidad, 0);
  }

  async confirmarPedido() {
    if (this.itemsPedido.length === 0) {
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

        console.log('Pedido ID a modificar:', pedidoId);
        console.log('Es modificacion:', this.esModificacion);

        // Actualizar pedido existente
        await this.supabaseService.client
          .from('pedidos')
          .update({ estado: 'pendiente', subtotal: this.totalPedido, total: this.totalPedido })
          .eq('id', pedidoId);

        // Borrar items anteriores y reemplazar
        const { error: errorDelete } = await this.supabaseService.client
          .from('pedido_items')
          .delete()
          .eq('pedido_id', pedidoId);

        console.log('Error delete:', errorDelete);

      } else {
        // Crear pedido nuevo
        const { data: pedidoData, error: errorPedido } = await this.supabaseService.client
          .from('pedidos')
          .insert({
            mesa_id: this.mesaId,
            cliente_id: this.usuarioActual?.id || '00000000-0000-0000-0000-000000000000',
            estado: 'pendiente',
            subtotal: this.totalPedido,
            total: this.totalPedido
          })
          .select()
          .single();

        if (errorPedido) throw errorPedido;
        pedidoId = pedidoData.id;
      }

      // Insertar los items
      const items = this.itemsPedido.map(item => ({
        pedido_id: pedidoId,
        producto_id: item.producto.id,
        cantidad: item.cantidad,
        precio_unit: item.producto.precio
      }));

      console.log('Items a insertar:', items);

      const { error: errorItems } = await this.supabaseService.client
        .from('pedido_items')
        .insert(items);

      console.log('Error insert items:', errorItems);

      if (errorItems) throw errorItems;

      // ── PUSH NOTIFICATION AL MOZO (Punto 12) ──────────────────
      try {
        await this.pushNotification.sendGlobalPushNotification(
          '🍽️ Nuevo pedido',
          `Mesa ${this.numeroMesa} realizó un pedido. ¡Revisalo!`
        );
      } catch (pushError) {
        console.warn('No se pudo enviar la push notification:', pushError);
      }

      await this.mostrarToast(
        this.esModificacion ? '¡Pedido actualizado!' : '¡Pedido enviado! El mozo lo confirmará pronto.',
        'success'
      );
      this.router.navigateByUrl(`/mesa/${this.mesaId}`, { replaceUrl: true });

    } catch (error: any) {
      console.error('Error:', error);
      await this.mostrarToast('No se pudo enviar el pedido.', 'danger');
    } finally {
      await loading.dismiss();
    }
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
}