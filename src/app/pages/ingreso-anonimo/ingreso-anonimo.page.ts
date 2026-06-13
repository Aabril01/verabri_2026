import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { SupabaseService } from '../../services/supabase';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { PushNotification } from 'src/app/services/push-notifications';

@Component({
  standalone: false,
  selector: 'app-ingreso-anonimo',
  templateUrl: './ingreso-anonimo.page.html',
  styleUrls: ['./ingreso-anonimo.page.scss'],
})
export class IngresoAnonimoPage implements OnInit {

  nombre = '';
  fotoUrl: string | null = null;
  fotoArchivo: File | null = null;
  errorNombre = '';
  errorFoto = '';
  errorGeneral = '';
  cargando = false;
  paso: 'datos' | 'escanear' | 'espera' = 'datos';
  clienteId: string = '';
  mesaAsignada: any = null;

  constructor(
    private router: Router,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private supabaseService: SupabaseService,
    private pushNotifications: PushNotification
  ) {}

  ngOnInit() {}

  async seleccionarFoto() {
    try {
      if (Capacitor.getPlatform() === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target.files[0];
          if (file) {
            this.fotoArchivo = file;
            const reader = new FileReader();
            reader.onload = (r: any) => {
              this.fotoUrl = r.target.result;
              this.errorFoto = '';
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
        return;
      }

      const image = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });

      if (image.dataUrl) {
        this.fotoUrl = image.dataUrl;
        this.errorFoto = '';
        const response = await fetch(image.dataUrl);
        const blob = await response.blob();
        this.fotoArchivo = new File([blob], `anonimo-${Date.now()}.jpg`, { type: 'image/jpeg' });
      }
    } catch (e) {}
  }

  async continuar() {
    this.errorNombre = '';
    this.errorFoto = '';

    if (!this.nombre || this.nombre.trim().length < 2) {
      this.errorNombre = 'El nombre es obligatorio (mínimo 2 caracteres).';
      await this.supabaseService.vibrarError();
      return;
    }

    if (!this.fotoUrl || !this.fotoArchivo) {
      this.errorFoto = 'La foto es obligatoria.';
      await this.supabaseService.vibrarError();
      return;
    }

    this.paso = 'escanear';
  }

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

  async procesarIngreso() {
    this.cargando = true;
    const loading = await this.loadingController.create({
      spinner: 'crescent',
      message: 'Registrando en lista de espera...',
      cssClass: 'spinner-verabri',
    });
    await loading.present();

    try {
      const urlFoto = await this.supabaseService.subirFoto(this.fotoArchivo!, 'anonimos');
      const fcmToken = this.pushNotifications.getFCMToken();
      this.clienteId = crypto.randomUUID();

      const { error } = await this.supabaseService.client
        .from('lista_espera')
        .insert({
          cliente_id: this.clienteId,
          nombre: this.nombre.trim(),
          foto_url: urlFoto,
          estado: 'esperando',
          fcm_token: fcmToken || null
        });

      if (error) throw error;

      // Guardar sesión anónima por 20 minutos
      localStorage.setItem('sesion_anonima', JSON.stringify({
        cliente_id: this.clienteId,
        nombre: this.nombre.trim(),
        foto_url: urlFoto,
        expira: Date.now() + 20 * 60 * 1000
      }));

      this.paso = 'espera';
      this.pushNotifications.enviarPushNotificationAUsuario(
        "¡Nueva petición!",
        "Un cliente ha solicitado una mesa.",
        "metre@verabri.com"
      );
      await this.mostrarToast('¡Estás en la lista de espera!', 'success');

    } catch (error: any) {
      console.error('Error:', error);
      await this.supabaseService.vibrarError();
      this.errorGeneral = error?.message || 'No se pudo registrar. Intentá de nuevo.';
    } finally {
      await loading.dismiss();
      this.cargando = false;
    }
  }

  async verificarMesaAsignada() {
    try {
      const { data } = await this.supabaseService.client
        .from('mesas')
        .select('*')
        .eq('cliente_id', this.clienteId)
        .eq('estado', 'ocupada')
        .maybeSingle();

      if (data) {
        this.mesaAsignada = data;
        await this.mostrarToast(`¡Te asignaron la Mesa ${data.numero}!`, 'success');
      } else {
        await this.mostrarToast('Todavía no te asignaron una mesa. Esperá un momento.', 'warning');
      }
    } catch (e) {
      console.error('Error verificando mesa:', e);
    }
  }

  async escanearMesa() {
    try {
      if (Capacitor.getPlatform() === 'web') {
        this.router.navigateByUrl(`/mesa/${this.mesaAsignada.id}`);
        return;
      }

      if (Capacitor.getPlatform() === 'android') {
        const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        if (!available) await BarcodeScanner.installGoogleBarcodeScannerModule();
      }

      const { barcodes } = await BarcodeScanner.scan();
      if (barcodes.length === 0) {
        await this.mostrarToast('No se pudo obtener datos al escanear', 'danger');
        return;
      }

      const qrRawData = barcodes[0].displayValue;
      const datosMesa = JSON.parse(qrRawData);

      if (datosMesa.tipo !== 'mesa') {
        await this.mostrarToast('El QR no pertenece a una mesa', 'danger');
        return;
      }

      if (datosMesa.numero !== this.mesaAsignada.numero) {
        await this.mostrarToast('Esta no es tu mesa asignada.', 'warning');
        return;
      }

      this.router.navigateByUrl(`/mesa/${this.mesaAsignada.id}`);

    } catch (e: any) {
      console.warn('Error al escanear mesa:', e.message);
    }
  }

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