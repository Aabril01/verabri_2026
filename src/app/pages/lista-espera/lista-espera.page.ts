import { Component, OnInit } from '@angular/core';
import { LoadingController, ToastController, AlertController } from '@ionic/angular';
import { SupabaseService } from '../../services/supabase';
import { PushNotification } from 'src/app/services/push-notifications';

@Component({
  standalone: false,
  selector: 'app-lista-espera',
  templateUrl: './lista-espera.page.html',
  styleUrls: ['./lista-espera.page.scss'],
})
export class ListaEsperaPage implements OnInit {

  clientes: any[] = [];
  mesas: any[] = [];
  cargando = true;
  clienteSeleccionado: any = null;
  mesaSeleccionadaId: string = '';

  constructor(
    private supabaseService: SupabaseService,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private alertController: AlertController,
    private pushNotificatons: PushNotification
  ) {}

  async ngOnInit() {
    await this.cargarDatos();
  }

  async cargarDatos() {
    const loading = await this.loadingController.create({
      spinner: 'crescent',
      message: 'Cargando lista de espera...',
      cssClass: 'spinner-verabri',
    });
    await loading.present();

    try {
      const { data: clientesData, error: errorClientes } = await this.supabaseService.client
        .from('lista_espera')
        .select('*')
        .eq('estado', 'esperando')
        .order('created_at', { ascending: true });

      if (errorClientes) throw errorClientes;
      this.clientes = clientesData || [];

      const { data: mesasData, error: errorMesas } = await this.supabaseService.client
        .from('mesas')
        .select('*')
        .eq('estado', 'vacia')
        .order('numero', { ascending: true });

      if (errorMesas) throw errorMesas;
      this.mesas = mesasData || [];

    } catch (error: any) {
      console.error('Error:', error);
      await this.mostrarToast('Error al cargar los datos.', 'danger');
    } finally {
      await loading.dismiss();
      this.cargando = false;
    }
  }

  async asignarMesa(cliente: any) {
    if (this.mesas.length === 0) {
      await this.mostrarToast('No hay mesas disponibles en este momento.', 'warning');
      return;
    }
    this.clienteSeleccionado = cliente;
    this.mesaSeleccionadaId = '';
  }

  cancelarSeleccion() {
    this.clienteSeleccionado = null;
    this.mesaSeleccionadaId = '';
  }

  async confirmarSeleccionMesa() {
    if (!this.mesaSeleccionadaId || !this.clienteSeleccionado) return;
    await this.confirmarAsignacion(this.clienteSeleccionado, this.mesaSeleccionadaId);
    this.clienteSeleccionado = null;
    this.mesaSeleccionadaId = '';
  }

  async confirmarAsignacion(cliente: any, mesaId: string) {
    const loading = await this.loadingController.create({
      spinner: 'crescent',
      message: 'Asignando mesa...',
      cssClass: 'spinner-verabri',
    });
    await loading.present();

    try {
      const { error: errorMesa } = await this.supabaseService.client
        .from('mesas')
        .update({ estado: 'ocupada', cliente_id: cliente.cliente_id })
        .eq('id', mesaId);

      if (errorMesa) throw errorMesa;

      const { error: errorEspera } = await this.supabaseService.client
        .from('lista_espera')
        .update({ estado: 'asignado' })
        .eq('id', cliente.id);

      if (errorEspera) throw errorEspera;

      this.pushNotificatons.enviarPushNotificationPorID(
        'Mesa asignada',
        '¡Ya podés solicitar un pedido!',
        cliente.cliente_id
      );

      await this.mostrarToast(`La mesa se asignó a ${cliente.nombre} correctamente.`, 'success');
      await this.cargarDatos();

    } catch (error: any) {
      console.error('Error:', error);
      await this.mostrarToast('No se pudo asignar la mesa.', 'danger');
    } finally {
      await loading.dismiss();
    }
  }

  formatearTipo(tipo: string): string {
    const tipos: any = {
      'vip': 'VIP',
      'estandar': 'Estándar',
      'movilidad_reducida': 'Movilidad reducida'
    };
    return tipos[tipo] || tipo;
  }

  formatearHora(fecha: string): string {
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