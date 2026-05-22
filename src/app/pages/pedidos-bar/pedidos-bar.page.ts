import { Component, OnInit } from '@angular/core';
import { LoadingController, ToastController } from '@ionic/angular';
import { SupabaseService } from '../../services/supabase';
import { PushNotification } from '../../services/push-notifications';

@Component({
  standalone: false,
  selector: 'app-pedidos-bar',
  templateUrl: './pedidos-bar.page.html',
  styleUrls: ['./pedidos-bar.page.scss'],
})
export class PedidosBarPage implements OnInit {

  pedidos: any[] = [];
  cargando = true;

  constructor(
    private supabaseService: SupabaseService,
    private pushNotification: PushNotification,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    await this.cargarPedidos();
  }

  async ionViewWillEnter() {
    await this.cargarPedidos();
  }

  async cargarPedidos() {
    const loading = await this.loadingController.create({
      spinner: 'crescent',
      message: 'Cargando pedidos...',
      cssClass: 'spinner-verabri',
    });
    await loading.present();

    try {
      const { data, error } = await this.supabaseService.client
        .from('pedidos')
        .select(`
          *,
          mesas (numero),
          pedido_items (
            cantidad,
            productos (nombre, tipo, tiempo_min)
          )
        `)
        .in('estado', ['confirmado', 'en_bar'])
        .eq('bar_listo', false)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Filtrar solo pedidos que tengan bebidas
      this.pedidos = (data || []).filter((p: any) =>
        p.pedido_items.some((item: any) => item.productos?.tipo === 'bebida')
      );

    } catch (error: any) {
      console.error('Error:', error);
      await this.mostrarToast('Error al cargar los pedidos.', 'danger');
    } finally {
      await loading.dismiss();
      this.cargando = false;
    }
  }

  getBebidasDelPedido(pedido: any) {
    return pedido.pedido_items.filter((item: any) => item.productos?.tipo === 'bebida');
  }

  async marcarListo(pedido: any) {
    const loading = await this.loadingController.create({
      spinner: 'crescent',
      message: 'Actualizando...',
      cssClass: 'spinner-verabri',
    });
    await loading.present();

    try {
      // Marcar bar como listo
      await this.supabaseService.client
        .from('pedidos')
        .update({ bar_listo: true })
        .eq('id', pedido.id);

      // Verificar si cocina también está lista
      const { data: pedidoActual } = await this.supabaseService.client
        .from('pedidos')
        .select('cocina_listo, bar_listo, mesas(numero)')
        .eq('id', pedido.id)
        .single();

      const tienePlatos = pedido.pedido_items.some((item: any) => item.productos?.tipo === 'plato');

      // Si no tiene platos o cocina ya terminó → pedido completo
      if (!tienePlatos || pedidoActual?.cocina_listo) {
        await this.supabaseService.client
          .from('pedidos')
          .update({ estado: 'listo' })
          .eq('id', pedido.id);

        // Push al mozo
        try {
          await this.pushNotification.sendGlobalPushNotification(
            '✅ Pedido listo',
            `El pedido de Mesa ${pedido.mesas?.numero} está completo para entregar.`
          );
        } catch (e) {
          console.warn('Error push:', e);
        }

        await this.mostrarToast('¡Pedido completo! El mozo fue notificado.', 'success');
      } else {
        await this.mostrarToast('¡Bebidas listas! Esperando que cocina termine.', 'success');
      }

      await this.cargarPedidos();

    } catch (error: any) {
      console.error('Error:', error);
      await this.mostrarToast('Error al actualizar el pedido.', 'danger');
    } finally {
      await loading.dismiss();
    }
  }

  formatearFecha(fecha: string): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) +
      ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
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