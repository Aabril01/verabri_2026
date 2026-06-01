import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { SupabaseService } from '../../services/supabase';
import { PushNotification } from '../../services/push-notifications';

@Component({
  standalone: false,
  selector: 'app-pedidos-mozo',
  templateUrl: './pedidos-mozo.page.html',
  styleUrls: ['./pedidos-mozo.page.scss'],
})
export class PedidosMozoPage implements OnInit {

  pedidos: any[] = [];
  cargando = true;

  constructor(
    private router: Router,
    private supabaseService: SupabaseService,
    private pushNotification: PushNotification,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private alertController: AlertController
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
            precio_unit,
            subtotal,
            productos (nombre, tipo)
          )
        `)
        .in('estado', ['pendiente', 'rechazado', 'confirmado', 'listo', 'pagado'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      this.pedidos = data || [];

    } catch (error: any) {
      console.error('Error:', error);
      await this.mostrarToast('Error al cargar los pedidos.', 'danger');
    } finally {
      await loading.dismiss();
      this.cargando = false;
    }
  }

  getEstadoPreparacion(pedido: any): string {
    if (pedido.estado === 'listo') return '✅ Listo para entregar';
    if (pedido.cocina_listo && pedido.bar_listo) return '✅ Todo listo';
    if (pedido.cocina_listo) return '🍽️ Cocina lista — bar en preparación';
    if (pedido.bar_listo) return '🥤 Bar listo — cocina en preparación';
    return '🔄 En preparación';
  }

  getColorEstado(pedido: any): string {
    if (pedido.estado === 'listo') return 'success';
    if (pedido.estado === 'rechazado') return 'danger';
    if (pedido.estado === 'pendiente') return 'warning';
    if (pedido.cocina_listo || pedido.bar_listo) return 'tertiary';
    return 'primary';
  }

  async confirmarPedido(pedido: any) {
    const alert = await this.alertController.create({
      header: 'Confirmar pedido',
      message: `¿Confirmás el pedido de la Mesa ${pedido.mesas?.numero}?`,
      cssClass: 'alerta-verabri',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Confirmar',
          handler: async () => {
            await this.cambiarEstadoPedido(pedido, 'confirmado');
          }
        }
      ]
    });
    await alert.present();
  }

  async rechazarPedido(pedido: any) {
    const alert = await this.alertController.create({
      header: 'Rechazar pedido',
      message: `¿Rechazás el pedido de la Mesa ${pedido.mesas?.numero}? El cliente podrá modificarlo.`,
      cssClass: 'alerta-verabri',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Rechazar',
          handler: async () => {
            await this.cambiarEstadoPedido(pedido, 'rechazado');
          }
        }
      ]
    });
    await alert.present();
  }

  async entregarPedido(pedido: any) {
    const alert = await this.alertController.create({
      header: 'Entregar pedido',
      message: `¿Confirmás la entrega del pedido a la Mesa ${pedido.mesas?.numero}?`,
      cssClass: 'alerta-verabri',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Entregar',
          handler: async () => {
            await this.cambiarEstadoPedido(pedido, 'entregado');
          }
        }
      ]
    });
    await alert.present();
  }

  async cambiarEstadoPedido(pedido: any, estado: string) {
    const loading = await this.loadingController.create({
      spinner: 'crescent',
      message: 'Actualizando pedido...',
      cssClass: 'spinner-verabri',
    });
    await loading.present();

    try {
      const { error } = await this.supabaseService.client
        .from('pedidos')
        .update({ estado })
        .eq('id', pedido.id);

      if (error) throw error;

      // ── PUSH PUNTO 13 — Mozo rechaza → notificar al cliente ──
      if (estado === 'rechazado' && pedido.cliente_id) {
        try {
          await this.pushNotification.enviarPushNotificationPorID(
            '❌ Pedido rechazado',
            `Tu pedido de la Mesa ${pedido.mesas?.numero} fue rechazado. Podés modificarlo.`,
            pedido.cliente_id
          );
        } catch (pushError) {
          console.warn('No se pudo enviar push al cliente:', pushError);
        }
      }

      // ── PUSH PUNTO 14 — Mozo confirma → notificar a cocina y bar ──
      if (estado === 'confirmado') {
        try {
          await this.pushNotification.enviarPushNotificationAUsuario(
            '🍽️ Nuevo pedido confirmado',
            `Pedido de Mesa ${pedido.mesas?.numero} listo para preparar.`,
            "cocinero@verabri.com"
          );
          await this.pushNotification.enviarPushNotificationAUsuario(
            '🍽️ Nuevo pedido confirmado',
            `Pedido de Mesa ${pedido.mesas?.numero} listo para preparar.`,
            "cantinero@verabri.com"
          );

        } catch (pushError) {
          console.warn('No se pudo enviar push a cocina/bar:', pushError);
        }
      }

      // ── PUSH PUNTO 19 — Mozo entrega → notificar al cliente ──
      if (estado === 'entregado' && pedido.cliente_id) {
        try {
          await this.pushNotification.enviarPushNotificationPorID(
            '🍽️ ¡Tu pedido llegó!',
            `El mozo entregó tu pedido en la Mesa ${pedido.mesas?.numero}. ¡Buen provecho!`,
            pedido.cliente_id
          );
        } catch (pushError) {
          console.warn('No se pudo enviar push al cliente:', pushError);
        }
      }

      const mensajes: any = {
        'confirmado': 'Pedido confirmado y enviado a cocina y bar.',
        'rechazado': 'Pedido rechazado.',
        'entregado': 'Pedido entregado al cliente.'
      };

      await this.mostrarToast(mensajes[estado] || 'Pedido actualizado.', 'success');
      await this.cargarPedidos();

    } catch (error: any) {
      console.error('Error:', error);
      await this.mostrarToast('Error al actualizar el pedido.', 'danger');
    } finally {
      await loading.dismiss();
    }
  }

  formatearHora(fecha: string): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
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

   // ── PUNTO 22 — Mozo confirma pago → liberar mesa y notificar──
  async confirmarPago(pedido: any) {
    const alert = await this.alertController.create({
      header: 'Confirmar pago',
      message: `¿Confirmás el pago de la Mesa ${pedido.mesas?.numero}? La mesa quedará libre.`,
      cssClass: 'alerta-verabri',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Confirmar pago',
          handler: async () => {
            const loading = await this.loadingController.create({
              spinner: 'crescent',
              message: 'Liberando mesa...',
              cssClass: 'spinner-verabri',
            });
            await loading.present();

            try {
              // Liberar la mesa
              await this.supabaseService.client
                .from('mesas')
                .update({ estado: 'vacia' })
                .eq('id', pedido.mesa_id);

              // Marcar pedido como pagado (ya está) — solo actualizamos updated_at
              await this.supabaseService.client
                .from('pedidos')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', pedido.id);

              // Push al dueño y supervisor
              await this.pushNotification.enviarPushNotificationAUsuario(
                '✅ Pago confirmado',
                `La Mesa ${pedido.mesas?.numero} pagó y fue liberada.`,
                'dueno@verabri.com'
              );
              await this.pushNotification.enviarPushNotificationAUsuario(
                '✅ Pago confirmado',
                `La Mesa ${pedido.mesas?.numero} pagó y fue liberada.`,
                'supervisor@verabri.com'
              );

              await this.pushNotification.enviarPushNotificationPorID(
                '✅ Pago confirmado',
                `El mozo validó el pago. ¡Gracias por tu estadía!`,
                pedido.cliente_id
              );

              await this.mostrarToast('¡Pago confirmado! Mesa liberada.', 'success');
              await this.cargarPedidos();

            } catch (error: any) {
              await this.mostrarToast('Error al confirmar el pago.', 'danger');
            } finally {
              await loading.dismiss();
            }
          }
        }
      ]
    });
    await alert.present();
  }
}