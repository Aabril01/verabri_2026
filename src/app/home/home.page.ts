import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { SupabaseService } from '../services/supabase';

@Component({
  standalone: false,
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit {

  perfil: string = '';
  nombre: string = '';
  userId: string = '';

  constructor(
    private router: Router,
    private supabaseService: SupabaseService,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    // Primero intentar desde el BehaviorSubject
    const usuarioCacheado = this.supabaseService.usuarioActual;
    if (usuarioCacheado) {
      this.perfil = usuarioCacheado.perfil || '';
      this.nombre = usuarioCacheado.nombre || '';
      const sesion = await this.supabaseService.obtenerSesion();
      this.userId = sesion?.user?.id || '';
      return;
    }

    // Si no hay caché, intentar desde la sesión
    try {
      const sesion = await this.supabaseService.obtenerSesion();
      if (sesion) {
        this.userId = sesion.user.id;
        const usuario = await this.supabaseService.cargarPerfil(sesion.user.id);
        this.perfil = usuario?.perfil || '';
        this.nombre = usuario?.nombre || '';
      }
    } catch(e) {
      console.error('Error cargando perfil:', e);
    }
  }

  async irAMesa() {
    const loading = await this.loadingController.create({
      spinner: 'crescent',
      message: 'Verificando mesa...',
      cssClass: 'spinner-verabri',
    });
    await loading.present();

    try {
      // Verificar si el cliente ya está en lista de espera
      const { data: enEspera } = await this.supabaseService.client
        .from('lista_espera')
        .select('*')
        .eq('cliente_id', this.userId)
        .eq('estado', 'esperando')
        .maybeSingle();

      if (enEspera) {
        // Ya está en lista de espera, avisar que espere al metre
        await loading.dismiss();
        await this.mostrarToast('Ya estás en la lista de espera. Aguardá a que el metre te asigne una mesa.', 'warning');
        return;
      }

      // Verificar si ya tiene mesa asignada
      const { data: mesaAsignada } = await this.supabaseService.client
        .from('mesas')
        .select('*')
        .eq('cliente_id', this.userId)
        .eq('estado', 'ocupada')
        .maybeSingle();

      await loading.dismiss();

      if (mesaAsignada) {
        // Tiene mesa asignada, ir a la mesa
        this.router.navigateByUrl(`/mesa/${mesaAsignada.id}`);
      } else {
        // No tiene mesa ni está en espera, mandarlo a anotarse
        this.router.navigateByUrl('/ingreso-cliente');
      }

    } catch (error: any) {
      await loading.dismiss();
      console.error('Error:', error);
      await this.mostrarToast('Error al verificar tu mesa.', 'danger');
    }
  }

  async cerrarSesion() {
    await this.supabaseService.cerrarSesion();
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  private async mostrarToast(mensaje: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 3000,
      position: 'top',
      color,
      icon: color === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline'
    });
    await toast.present();
  }
}