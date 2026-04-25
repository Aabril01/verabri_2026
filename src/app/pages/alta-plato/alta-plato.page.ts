import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { SupabaseService } from '../../services/supabase';

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

  async guardarPlato() {
    this.formulario.markAllAsTouched();

    const fotasCompletas = this.fotos.every(f => f !== null);
    if (!fotasCompletas) {
      this.errorFotos = 'Las 3 fotos del plato son obligatorias.';
      return;
    }

    if (this.formulario.invalid) return;

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

      // Verificar que no exista ese plato
      const { data: platoExistente } = await this.supabaseService.client
        .from('productos')
        .select('id')
        .eq('nombre', nombre)
        .eq('tipo', 'plato')
        .single();

      if (platoExistente) {
        this.errorGeneral = `El plato "${nombre}" ya existe en el menú.`;
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
          tipo: 'plato',
          activo: true
        });

      if (error) throw error;

      await this.mostrarToast(`¡Plato "${nombre}" guardado correctamente!`, 'success');
      this.router.navigateByUrl('/home', { replaceUrl: true });

    } catch (error: any) {
      this.errorGeneral = 'No se pudo guardar el plato. Verificá los datos e intentá nuevamente.';
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