import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { SupabaseService } from '../../services/supabase';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

@Component({
  standalone: false,
  selector: 'app-alta-bebida',
  templateUrl: './alta-bebida.page.html',
  styleUrls: ['./alta-bebida.page.scss'],
})
export class AltaBebidaPage implements OnInit {

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
    private supabaseService: SupabaseService
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

      const image = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt // ← esto muestra el selector cámara/galería
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

  async guardarBebida() {
    this.formulario.markAllAsTouched();

    const fotosCompletas = this.fotos.every(f => f !== null);
    if (!fotosCompletas) {
      this.errorFotos = 'Las 3 fotos de la bebida son obligatorias.';
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
      message: 'Guardando bebida...',
      cssClass: 'spinner-verabri',
    });
    await loading.present();

    try {
      const { nombre, descripcion, tiempo_min, precio } = this.formulario.value;

      const { data: bebidaExistente } = await this.supabaseService.client
        .from('productos')
        .select('id')
        .eq('nombre', nombre)
        .eq('tipo', 'bebida')
        .maybeSingle();

      if (bebidaExistente) {
        this.errorGeneral = `La bebida "${nombre}" ya existe en el menú.`;
        await this.supabaseService.vibrarError();
        await loading.dismiss();
        this.cargando = false;
        return;
      }

      const urlsFotos = await Promise.all(
        this.fotosArchivos.map(archivo =>
          this.supabaseService.subirFoto(archivo!, 'bebidas')
        )
      );

      const { error } = await this.supabaseService.client
        .from('productos')
        .insert({
          nombre, descripcion, tiempo_min, precio,
          tipo: 'bebida', activo: true,
          foto1_url: urlsFotos[0],
          foto2_url: urlsFotos[1],
          foto3_url: urlsFotos[2]
        });

      if (error) throw error;

      await this.mostrarToast(`¡Bebida "${nombre}" guardada correctamente!`, 'success');
      this.router.navigateByUrl('/home', { replaceUrl: true });

    } catch (error: any) {
      await this.supabaseService.vibrarError();
      this.errorGeneral = error?.message || 'No se pudo guardar la bebida.';
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