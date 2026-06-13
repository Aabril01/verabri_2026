import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, ToastController, LoadingController } from '@ionic/angular';
import { SupabaseService } from '../../services/supabase';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

@Component({
  standalone: false,
  selector: 'app-alta-plato',
  templateUrl: './alta-plato.page.html',
  styleUrls: ['./alta-plato.page.scss'],
})
export class AltaPlatoPage implements OnInit {

  formulario!: FormGroup;
  fotos: (string | null)[] = [null, null, null];
  fotosArchivos: (File | null)[] = [null, null, null];
  cargando = false;
  errorGeneral = '';
  errorFotos = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private supabaseService: SupabaseService,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.formulario = this.fb.group({
      nombre:      ['', [Validators.required, Validators.minLength(2)]],
      descripcion: ['', [Validators.required, Validators.minLength(10)]],
      tiempo_min:  ['', [Validators.required, Validators.min(1)]],
      precio:      ['', [Validators.required, Validators.min(1)]]
    });
  }

  campoInvalido(campo: string): boolean {
    const control = this.formulario.get(campo);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  private elegirFuente(): Promise<CameraSource | null> {
    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header: 'Seleccionar foto',
        cssClass: 'alerta-verabri',
        buttons: [
          { text: 'Cámara', handler: () => resolve(CameraSource.Camera) },
          { text: 'Galería', handler: () => resolve(CameraSource.Photos) },
          { text: 'Cancelar', role: 'cancel', handler: () => resolve(null) }
        ]
      });
      await alert.present();
    });
  }

  async seleccionarFoto(index: number) {
    try {
      if (Capacitor.getPlatform() === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target.files[0];
          if (file) {
            this.fotosArchivos[index] = file;
            const reader = new FileReader();
            reader.onload = (r: any) => {
              this.fotos[index] = r.target.result;
              this.errorFotos = '';
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
        return;
      }

      const source = await this.elegirFuente();
      if (!source) return;

      const image = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source
      });

      if (image.dataUrl) {
        this.fotos[index] = image.dataUrl;
        this.errorFotos = '';
        const response = await fetch(image.dataUrl);
        const blob = await response.blob();
        this.fotosArchivos[index] = new File([blob], `foto-${index}-${Date.now()}.jpg`, { type: 'image/jpeg' });
      }
    } catch (e) {
      // Usuario canceló
    }
  }

  async guardarPlato() {
    this.formulario.markAllAsTouched();

    const fotasCompletas = this.fotos.every(f => f !== null);
    if (!fotasCompletas) {
      this.errorFotos = 'Las 3 fotos del plato son obligatorias.';
      await this.supabaseService.vibrarError();
      return;
    }

    if (this.formulario.invalid) {
      await this.supabaseService.vibrarError();
      return;
    }

    this.cargando = true;
    this.errorGeneral = '';

    const loading = await this.loadingController.create({
      spinner: 'crescent',
      message: 'Guardando plato...',
      cssClass: 'spinner-verabri',
    });
    await loading.present();

    try {
      const { nombre, descripcion, tiempo_min, precio } = this.formulario.value;

      const { data: platoExistente } = await this.supabaseService.client
        .from('productos')
        .select('id')
        .eq('nombre', nombre)
        .eq('tipo', 'plato')
        .maybeSingle();

      if (platoExistente) {
        this.errorGeneral = `El plato "${nombre}" ya existe en el menú.`;
        await this.supabaseService.vibrarError();
        await loading.dismiss();
        this.cargando = false;
        return;
      }

      const urlsFotos = await Promise.all(
        this.fotosArchivos.map(archivo =>
          this.supabaseService.subirFoto(archivo!, 'platos')
        )
      );

      const { error } = await this.supabaseService.client
        .from('productos')
        .insert({
          nombre, descripcion, tiempo_min, precio,
          tipo: 'plato', activo: true,
          foto1_url: urlsFotos[0],
          foto2_url: urlsFotos[1],
          foto3_url: urlsFotos[2]
        });

      if (error) throw error;

      await this.mostrarToast(`¡Plato "${nombre}" guardado correctamente!`, 'success');
      this.router.navigateByUrl('/home', { replaceUrl: true });

    } catch (error: any) {
      await this.supabaseService.vibrarError();
      this.errorGeneral = error?.message || 'No se pudo guardar el plato.';
    } finally {
      await loading.dismiss();
      this.cargando = false;
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