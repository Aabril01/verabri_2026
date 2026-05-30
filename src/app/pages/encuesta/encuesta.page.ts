import { Component, OnInit } from '@angular/core';
import { SupabaseService } from 'src/app/services/supabase';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  standalone: false,
  selector: 'app-encuesta',
  templateUrl: './encuesta.page.html',
  styleUrls: ['./encuesta.page.scss'],
})
export class EncuestaPage implements OnInit {

  encuestaForm!: FormGroup;
  clienteId = '';
  pedidoId = '';
  mesaId = '';

  constructor(
    private toastController: ToastController,
    private supabase: SupabaseService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private loadingController: LoadingController,
    private router: Router
  ) {}

  async ngOnInit() {
    this.encuestaForm = this.fb.group({
      calificacion: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
      aspectos: this.fb.group({
        comida: [5, [Validators.required]],
        servicio: [5, [Validators.required]],
        limpieza: [5, [Validators.required]],
        ambiente: [5, [Validators.required]]
      }),
      volveria: [true, Validators.required],
      como_conocio: ['', Validators.required],
      comentario: ['', Validators.maxLength(500)]
    });

    this.pedidoId = this.route.snapshot.paramMap.get('pedidoId') || '';
    this.clienteId = this.route.snapshot.paramMap.get('usuarioId') || '';
    this.mesaId = this.route.snapshot.paramMap.get('mesaId') || '';
  }

  async guardarEncuesta() {
    this.encuestaForm.markAllAsTouched();

    if (this.encuestaForm.invalid) {
      await this.supabase.vibrarError();
      this.mostrarToast('Por favor, completa todos los campos requeridos.', 'danger');
      return;
    }

    const datosEncuesta = {
      cliente_id: this.clienteId,
      pedido_id: this.pedidoId,
      ...this.encuestaForm.value
    };

    const loading = await this.loadingController.create({
      spinner: 'crescent',
      message: 'Guardando encuesta...',
      cssClass: 'spinner-verabri',
    });
    await loading.present();

    try {
      const { error: errorEncuesta } = await this.supabase.client
        .from('encuestas')
        .insert({
          usuario_id: datosEncuesta.cliente_id,
          pedido_id: datosEncuesta.pedido_id,
          calificacion: datosEncuesta.calificacion,
          volveria: datosEncuesta.volveria,
          aspectos: datosEncuesta.aspectos,
          como_conocio: datosEncuesta.como_conocio,
          comentario: datosEncuesta.comentario
        });

      if (errorEncuesta) throw errorEncuesta;

      const { error: errorPedido } = await this.supabase.client
        .from('pedidos')
        .update({ encuesta_realizada: true })
        .eq('id', this.pedidoId);

      if (errorPedido) throw errorPedido;

      this.mostrarToast('¡Gracias por tu opinión! Encuesta enviada con éxito.', 'success');
      await loading.dismiss();
      this.encuestaForm.reset({ calificacion: 5, volveria: true });
      this.volver();

    } catch (error) {
      await this.supabase.vibrarError();
      this.mostrarToast('Hubo un error al enviar la encuesta. Intentalo de nuevo.', 'danger');
      await loading.dismiss();
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

  volver() {
    this.router.navigateByUrl(`/mesa/${this.mesaId}`);
  }
}