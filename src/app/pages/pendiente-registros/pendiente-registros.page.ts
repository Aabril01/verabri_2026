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
  
}
