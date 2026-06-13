import { Component, OnInit } from '@angular/core';
import { LoadingController, ToastController } from '@ionic/angular';
import { SupabaseService } from '../../services/supabase';

@Component({
  standalone: false,
  selector: 'app-estado-mesas',
  templateUrl: './estado-mesas.page.html',
  styleUrls: ['./estado-mesas.page.scss'],
})
export class EstadoMesasPage implements OnInit {

  mesas: any[] = [];
  cargando = true;

  constructor(
    private supabaseService: SupabaseService,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    await this.cargarMesas();
  }

  async ionViewWillEnter() {
    await this.cargarMesas();
  }

  async cargarMesas() {
    const loading = await this.loadingController.create({
      spinner: 'crescent',
      message: 'Cargando mesas...',
      cssClass: 'spinner-verabri',
    });
    await loading.present();

    try {
      const { data, error } = await this.supabaseService.client
        .from('mesas')
        .select('*')
        .order('numero', { ascending: true });

      if (error) throw error;
      this.mesas = data || [];

    } catch (error: any) {
      console.error('Error:', error);
      const toast = await this.toastController.create({
        message: 'Error al cargar las mesas.',
        duration: 2500,
        position: 'top',
        color: 'danger',
        icon: 'alert-circle-outline'
      });
      await toast.present();
    } finally {
      await loading.dismiss();
      this.cargando = false;
    }
  }

  get mesasLibres(): number {
    return this.mesas.filter(m => m.estado === 'vacia').length;
  }

  get mesasOcupadas(): number {
    return this.mesas.filter(m => m.estado === 'ocupada').length;
  }

  formatearTipo(tipo: string): string {
    const tipos: any = {
      'vip': 'VIP',
      'estandar': 'Estándar',
      'movilidad_reducida': 'Movilidad reducida'
    };
    return tipos[tipo] || tipo;
  }
}