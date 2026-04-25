import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { SupabaseService } from '../../services/supabase';

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

  seleccionarFoto(index: number) {
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
  }

  async guardarBebida() {
    this.formulario.markAllAsTouched();

    const fotosCompletas = this.fotos.every(f => f !== null);
    if (!fotosCompletas) {
      this.errorFotos = 'Las 3 fotos de la bebida son obligatorias.';
      return;
    }

    if (this.formulario.invalid) return;

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

      // Verificar que no exista esa bebida
      const { data: bebidaExistente } = await this.supabaseService.client
        .from('productos')
        .select('id')
        .eq('nombre', nombre)
        .eq('tipo', 'bebida')
        .single();

      if (bebidaExistente) {
        this.errorGeneral = `La bebida "${nombre}" ya existe en el menú.`;
        await loading.dismiss();
        this.cargando = false;
        return;
      }

      const { error } = await this.supabaseService.client
        .from('productos')
        .insert({
          nombre,
          descripcion,
          tiempo_min,
          precio,
          tipo: 'bebida',
          activo: true
        });

      if (error) throw error;

      await this.mostrarToast(`¡Bebida "${nombre}" guardada correctamente!`, 'success');
      this.router.navigateByUrl('/home', { replaceUrl: true });

    } catch (error: any) {
      this.errorGeneral = 'No se pudo guardar la bebida. Verificá los datos e intentá nuevamente.';
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