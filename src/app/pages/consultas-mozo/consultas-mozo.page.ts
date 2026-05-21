import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { SupabaseService } from '../../services/supabase';

@Component({
  standalone: false,
  selector: 'app-consultas-mozo',
  templateUrl: './consultas-mozo.page.html',
  styleUrls: ['./consultas-mozo.page.scss'],
})
export class ConsultasMozoPage implements OnInit {

  mesas: any[] = [];
  cargando = true;

  constructor(
    private router: Router,
    private supabaseService: SupabaseService,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    await this.cargarMesasConMensajes();
  }

  async cargarMesasConMensajes() {
    const loading = await this.loadingController.create({
      spinner: 'crescent',
      message: 'Cargando consultas...',
      cssClass: 'spinner-verabri',
    });
    await loading.present();

    try {
      // Traer todas las mesas ocupadas
      const { data: mesasData, error } = await this.supabaseService.client
        .from('mesas')
        .select('*')
        .eq('estado', 'ocupada')
        .order('numero', { ascending: true });

      if (error) throw error;

      // Para cada mesa, contar los mensajes
      const mesasConMensajes = await Promise.all(
        (mesasData || []).map(async (mesa: any) => {
          const { count } = await this.supabaseService.client
            .from('mensajes')
            .select('*', { count: 'exact', head: true })
            .eq('mesa_id', mesa.id);

          return { ...mesa, cantidad_mensajes: count || 0 };
        })
      );

      this.mesas = mesasConMensajes;

    } catch (error: any) {
      console.error('Error:', error);
      await this.mostrarToast('Error al cargar las consultas.', 'danger');
    } finally {
      await loading.dismiss();
      this.cargando = false;
    }
  }

  irAlChat(mesaId: string) {
    this.router.navigateByUrl(`/chat/${mesaId}`);
  }

  formatearTipo(tipo: string): string {
    const tipos: any = {
      'vip': 'VIP',
      'estandar': 'Estándar',
      'movilidad_reducida': 'Movilidad reducida'
    };
    return tipos[tipo] || tipo;
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