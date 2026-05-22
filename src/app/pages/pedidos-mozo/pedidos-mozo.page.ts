import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { SupabaseService } from '../../services/supabase';

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
    private loadingController: LoadingController,
    private toastController: ToastController,
    private alertController: AlertController
  ) {}

  async ngOnInit() {
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
      .in('estado', ['pendiente', 'rechazado'])        
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
            await this.cambiarEstadoPedido(pedido.id, 'confirmado');
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
            await this.cambiarEstadoPedido(pedido.id, 'rechazado');          }
        }
      ]
    });
    await alert.present();
  }

  async cambiarEstadoPedido(pedidoId: string, estado: string) {
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
        .eq('id', pedidoId);

      if (error) throw error;

      await this.mostrarToast(
        estado === 'confirmado' ? 'Pedido confirmado y enviado a cocina y bar.' : 'Pedido rechazado.',
        'success'
      );
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
}