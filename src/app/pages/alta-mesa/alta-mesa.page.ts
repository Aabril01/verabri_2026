import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { SupabaseService } from '../../services/supabase';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

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
  private qrBlob: Blob | null = null; 
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
        this.fotoArchivo = new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' });
      }
    } catch (e) {
      // Usuario canceló
    }
  }

  private blobAImagen(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });
  }

  // ── NUEVO: redibuja el QR agregando el número de mesa visible debajo ──
  private async generarQRConNumero(blobQR: Blob, numero: number): Promise<Blob> {
    const img = await this.blobAImagen(blobQR);
    const padding = 60;

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height + padding;

    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Mesa ${numero}`, canvas.width / 2, img.height + 42);

    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('No se pudo generar la imagen del QR.'));
      }, 'image/png');
    });
  }

  async guardarMesa() {
    this.formulario.markAllAsTouched();

    if (!this.fotoUrl) {
      this.errorFoto = 'La foto de la mesa es obligatoria.';
      await this.supabaseService.vibrarError();
      return;
    }

    if (this.formulario.invalid){
      await this.supabaseService.vibrarError();
     return;
    } 

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
        await this.supabaseService.vibrarError();
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

      // Descargar QR base, agregarle el número visible, y subir esa versión final
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrInfo)}`;
      let qrStorageUrl = qrApiUrl;

      try {
        const response = await fetch(qrApiUrl);
        const blobQRBase = await response.blob();
        const blobConNumero = await this.generarQRConNumero(blobQRBase, numero);
        this.qrBlob = blobConNumero; // NUEVO: lo guardamos para poder descargarlo en nativo

        const nombreQR = `qr-mesas/mesa-${numero}-${Date.now()}.png`;

        const { error: storageError } = await this.supabaseService.client.storage
          .from('fotos')
          .upload(nombreQR, blobConNumero, { contentType: 'image/png' });

        if (!storageError) {
          const { data: urlData } = this.supabaseService.client.storage
            .from('fotos')
            .getPublicUrl(nombreQR);
          qrStorageUrl = urlData.publicUrl;
        }
      } catch (e) {
        console.log('No se pudo generar/subir el QR con número, usando URL directa sin número visible', e);
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

      this.descargarQR();

    } catch (error: any) {
      await this.supabaseService.vibrarError();
      this.errorGeneral = 'No se pudo guardar la mesa. Verificá los datos e intentá nuevamente.';
    } finally {
      await loading.dismiss();
      this.cargando = false;
    }
  }

  async descargarQR() {
    if (Capacitor.getPlatform() === 'web') {
      const link = document.createElement('a');
      link.href = this.qrImagenUrl;
      link.download = `qr-mesa-${this.numeroMesaGuardada}.png`;
      link.target = '_blank';
      link.click();
      return;
    }

    if (!this.qrBlob) {
      await this.mostrarToast('No se encontró la imagen del QR para descargar.', 'danger');
      return;
    }

    try {
      const base64 = await this.blobABase64(this.qrBlob);
      const nombreArchivo = `qr-mesa-${this.numeroMesaGuardada}-${Date.now()}.png`;

      const resultado = await Filesystem.writeFile({
        path: nombreArchivo,
        data: base64,
        directory: Directory.Cache
      });

      await Share.share({
        title: `QR Mesa ${this.numeroMesaGuardada}`,
        url: resultado.uri,
        dialogTitle: 'Guardar o compartir el QR'
      });
    } catch (e) {
      console.error('Error al descargar QR en nativo:', e);
      await this.mostrarToast('No se pudo descargar el QR en el dispositivo.', 'danger');
    }
  }

  private blobABase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const resultado = reader.result as string;
        resolve(resultado.split(',')[1]); 
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
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