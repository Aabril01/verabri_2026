import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { SupabaseService } from '../../services/supabase';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Capacitor } from '@capacitor/core';

@Component({
  standalone: false,
  selector: 'app-ingreso-cliente',
  templateUrl: './ingreso-cliente.page.html',
  styleUrls: ['./ingreso-cliente.page.scss'],
})
export class IngresoClientePage implements OnInit {

  nombre: string = '';
  fotoUrl: string = '';
  userId: string = '';
  cargando = false;
  paso: 'escanear' | 'espera' = 'escanear';

  constructor(
    private router: Router,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private supabaseService: SupabaseService
  ) {}

  async ngOnInit() {
    const sesion = await this.supabaseService.obtenerSesion();
    if (sesion) {
      this.userId = sesion.user.id;
      const usuario = await this.supabaseService.cargarPerfil(sesion.user.id);
      this.nombre = usuario?.nombre || '';
      this.fotoUrl = usuario?.foto_url || '';
    }
  }

  // ── ESCANEAR QR ───────────────────────────────────────────────

  async escanearQR() {
    try {
      if (Capacitor.getPlatform() === 'web') {
        await this.procesarIngreso();
        return;
      }

      const { barcodes } = await BarcodeScanner.scan();
      if (barcodes.length > 0) {
        const contenido = barcodes[0].rawValue ?? '';
        const datos = JSON.parse(contenido);

        if (datos.tipo === 'ingreso' && datos.accion === 'lista-espera') {
          await this.procesarIngreso();
        } else {
          await this.mostrarToast('El código QR no es válido para el ingreso.', 'danger');
        }
      }
    } catch (error) {
      console.error('Error al escanear:', error);
      await this.mostrarToast('Error al escanear el código QR.', 'danger');
    }
  }

  // ── REGISTRAR EN LISTA DE ESPERA ──────────────────────────────

  async procesarIngreso() {
    const loading = await this.loadingController.create({
      spinner: 'crescent',
      message: 'Registrando en lista de espera...',
      cssClass: 'spinner-verabri',
    });
    await loading.present();

    try {
      // Verificar si ya está en lista de espera
      const { data: yaEnEspera } = await this.supabaseService.client
        .from('lista_espera')
        .select('*')
        .eq('cliente_id', this.userId)
        .eq('estado', 'esperando')
        .maybeSingle();

      if (yaEnEspera) {
        await loading.dismiss();
        await this.mostrarToast('Ya estás en la lista de espera.', 'warning');
        this.paso = 'espera';
        return;
      }

      // Insertar en lista_espera
      const { error } = await this.supabaseService.client
        .from('lista_espera')
        .insert({
          cliente_id: this.userId,
          nombre: this.nombre,
          foto_url: this.fotoUrl,
          estado: 'esperando'
        });

      if (error) throw error;

      this.paso = 'espera';
      await this.mostrarToast('¡Estás en la lista de espera!', 'success');

    } catch (error: any) {
      console.error('Error:', error);
      await this.mostrarToast('No se pudo registrar. Intentá de nuevo.', 'danger');
    } finally {
      await loading.dismiss();
    }
  }

  // ── TOAST ─────────────────────────────────────────────────────

  private async mostrarToast(mensaje: string, color: 'success' | 'danger' | 'warning') {
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