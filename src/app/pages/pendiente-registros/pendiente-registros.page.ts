import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { SupabaseService } from 'src/app/services/supabase';
import { addIcons } from 'ionicons';
import { checkmarkCircleOutline, closeCircleOutline } from 'ionicons/icons';

@Component({
  standalone: false,
  selector: 'app-pendiente-registros',
  templateUrl: './pendiente-registros.page.html',
  styleUrls: ['./pendiente-registros.page.scss'],
})
export class PendienteRegistrosPage implements OnInit {
  cargandoClientes = true;
  public clientes: any[] = [];

  constructor(
    private router: Router,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private supabaseService: SupabaseService
    
  ) { 
    //Iconos usados en botones
    addIcons({
      'checkmark-circle-outline': checkmarkCircleOutline,
      'close-circle-outline': closeCircleOutline
    });
  }

  async ngOnInit() {
    const loading = await this.loadingController.create({
      spinner: 'crescent',
      message: "Buscando clientes...",
      cssClass: 'spinner-verabri',
    });
    await loading.present();  

    this.traerUsuariosPendientes();
    await loading.dismiss();
  }

  // ── OBTENCIÓN DE CLIENTES ──────────────────────────────────────────────────────

  async traerUsuariosPendientes() {
    let usuarios = [];
    usuarios = await this.supabaseService.getUsers();
    this.clientes = usuarios.filter(u => u.estado === "pendiente");
    this.cargandoClientes = false;
  }

  //  ── CAMBIOS DE ESTADO ───────────────────────────────────────────────────────

  async cambiarEstado(correo: string, estado: string) {
    
    const loading = await this.loadingController.create({
      spinner: 'crescent',
      message: "Espere un momento...",
      cssClass: 'spinner-verabri',
    });

    try {

      await loading.present();

      await this.supabaseService.cambiarEstado(correo, estado);
      if (estado === "aceptado") {
        this.mostrarToast("El cliente fue aceptado.", "success");
        //Correo informando la aprobación
      } else {
        this.mostrarToast("El cliente fue rechazado.", "success");
        //Correo informando el rechazo
      }

      await this.traerUsuariosPendientes();
     
    } catch(error) {
      console.log("Ocurrió un error: " + error);
    } finally {
      await loading.dismiss();
    }
  }

  //  ── MENSAJES TOAST ───────────────────────────────────────────────────────
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
