import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { SupabaseService } from '../../services/supabase';

@Component({
  standalone: false,
  selector: 'app-alta-mesa',
  templateUrl: './alta-mesa.page.html',
  styleUrls: ['./alta-mesa.page.scss'],
})
export class AltaMesaPage implements OnInit {

  formulario!: FormGroup;
  fotoUrl: string | null = null;
  fotoArchivo: File | null = null;
  cargando = false;
  errorGeneral = '';
  errorFoto = '';
  qrGenerado = false;
  qrData = '';
  numeroMesaGuardada = 0;
  qrImagenUrl = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private supabaseService: SupabaseService
  ) {}

  ngOnInit() {
    this.formulario = this.fb.group({
      numero:   ['', [Validators.required, Validators.min(1)]],
      capacidad:['', [Validators.required, Validators.min(1)]],
      tipo:     ['', Validators.required]
    });
  }

  campoInvalido(campo: string): boolean {
    const control = this.formulario.get(campo);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  seleccionarTipo(tipo: string) {
    this.formulario.patchValue({ tipo });
    this.formulario.get('tipo')?.markAsTouched();
  }

  async seleccionarFoto() {
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
  }

  async guardarMesa() {
    this.formulario.markAllAsTouched();

    if (!this.fotoUrl) {
      this.errorFoto = 'La foto de la mesa es obligatoria.';
      return;
    }

    if (this.formulario.invalid) return;

    this.cargando = true;
    this.errorGeneral = '';

    const loading = await this.loadingController.create({
      spinner: 'crescent',
      message: 'Guardando mesa...',
      cssClass: 'spinner-verabri',
    });
    await loading.present();

    try {
      const { numero, capacidad, tipo } = this.formulario.value;

      // Verificar que no exista esa mesa
      const { data: mesaExistente } = await this.supabaseService.client
        .from('mesas')
        .select('id')
        .eq('numero', numero)
        .single();

      if (mesaExistente) {
        this.errorGeneral = `La mesa número ${numero} ya existe.`;
        await loading.dismiss();
        this.cargando = false;
        return;
      }

      // Generar datos del QR
      const qrInfo = JSON.stringify({
        tipo: 'mesa',
        numero,
        capacidad,
        tipomesa: tipo
      });

      // Descargar imagen del QR y subirla a Supabase Storage
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrInfo)}`;
      let qrStorageUrl = qrApiUrl;

      try {
        const response = await fetch(qrApiUrl);
        const blob = await response.blob();
        const nombreQR = `qr-mesas/mesa-${numero}-${Date.now()}.png`;

        const { error: storageError } = await this.supabaseService.client.storage
          .from('fotos')
          .upload(nombreQR, blob, { contentType: 'image/png' });

        if (!storageError) {
          const { data: urlData } = this.supabaseService.client.storage
            .from('fotos')
            .getPublicUrl(nombreQR);
          qrStorageUrl = urlData.publicUrl;
        }
      } catch (e) {
        console.log('No se pudo subir el QR al storage, usando URL directa');
      }

      // Subir foto de la mesa
      let fotoStorageUrl = '';
      if (this.fotoArchivo) {
        const nombreFoto = `fotos-mesas/mesa-${numero}-${Date.now()}.jpg`;
        const { error: fotoError } = await this.supabaseService.client.storage
          .from('fotos')
          .upload(nombreFoto, this.fotoArchivo, { contentType: 'image/jpeg' });

        if (!fotoError) {
          const { data: fotoUrlData } = this.supabaseService.client.storage
            .from('fotos')
            .getPublicUrl(nombreFoto);
          fotoStorageUrl = fotoUrlData.publicUrl;
        }
      }

      // Insertar en Supabase
      const { error } = await this.supabaseService.client
        .from('mesas')
        .insert({
          numero,
          capacidad,
          tipo,
          estado: 'vacia',
          foto_url: fotoStorageUrl,
          qr_url: qrStorageUrl
        });

      if (error) throw error;

      this.numeroMesaGuardada = numero;
      this.qrData = qrInfo;
      this.qrImagenUrl = qrStorageUrl;
      this.qrGenerado = true;

      await this.mostrarToast(`Mesa ${numero} guardada correctamente`, 'success');

    } catch (error: any) {
      this.errorGeneral = 'No se pudo guardar la mesa. Verificá los datos e intentá nuevamente.';
    } finally {
      await loading.dismiss();
      this.cargando = false;
    }
  }

  nuevaMesa() {
    this.formulario.reset();
    this.fotoUrl = null;
    this.fotoArchivo = null;
    this.qrGenerado = false;
    this.qrData = '';
    this.errorGeneral = '';
    this.errorFoto = '';
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