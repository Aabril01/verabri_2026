import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { SupabaseService } from '../services/supabase';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

@Component({
  standalone: false,
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit {

  perfil: string = '';
  nombre: string = '';
  userId: string = '';
  numeroMesaAsignada: number | null = null
  tieneMesa: boolean = false

  constructor(
    private router: Router,
    private supabaseService: SupabaseService,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    // Primero intentar desde el BehaviorSubject
    const usuarioCacheado = this.supabaseService.usuarioActual;
    if (usuarioCacheado) {
      this.perfil = usuarioCacheado.perfil || '';
      this.nombre = usuarioCacheado.nombre || '';
      const sesion = await this.supabaseService.obtenerSesion();
      this.userId = sesion?.user?.id || '';

      //Para saber cual mesa debe escanear
      if(this.perfil === "cliente_registrado"){
        await this.cargarDatos();
      }
      return;
    }

    // Si no hay caché, intentar desde la sesión
    try {
      const sesion = await this.supabaseService.obtenerSesion();
      if (sesion) {
        this.userId = sesion.user.id;
        const usuario = await this.supabaseService.cargarPerfil(sesion.user.id);
        this.perfil = usuario?.perfil || '';
        this.nombre = usuario?.nombre || '';

        if(this.perfil === "cliente_registrado"){
          await this.cargarDatos();
        }
      }

    } catch(e) {
      console.error('Error cargando perfil:', e);
    }
  }

  async cargarDatos(){
    // Verificar si ya tiene mesa asignada
    const { data: mesaAsignada } = await this.supabaseService.client
    .from('mesas')
    .select('*')
    .eq('cliente_id', this.userId)
    .eq('estado', 'ocupada')
    .maybeSingle();

    this.numeroMesaAsignada = mesaAsignada?.numero || null;
    if(this.numeroMesaAsignada){
      this.tieneMesa = true;
    }
  }

  async irAMesa() {
    const loading = await this.loadingController.create({
      spinner: 'crescent',
      message: 'Verificando mesa...',
      cssClass: 'spinner-verabri',
    });
    await loading.present();

    try {
      // Verificar si el cliente ya está en lista de espera
      const { data: enEspera } = await this.supabaseService.client
        .from('lista_espera')
        .select('*')
        .eq('cliente_id', this.userId)
        .eq('estado', 'esperando')
        .maybeSingle();

      if (enEspera) {
        // Ya está en lista de espera, avisar que espere al metre
        await loading.dismiss();
        await this.mostrarToast('Ya estás en la lista de espera. Aguardá a que el metre te asigne una mesa.', 'warning');
        return;
      }

      // Verificar si ya tiene mesa asignada
      const { data: mesaAsignada } = await this.supabaseService.client
        .from('mesas')
        .select('*')
        .eq('cliente_id', this.userId)
        .eq('estado', 'ocupada')
        .maybeSingle();

      await loading.dismiss();

      if (!mesaAsignada) {
        // No tiene mesa ni está en espera, mandarlo a anotarse
        this.router.navigateByUrl('/ingreso-cliente');
      
      } else {
        //Tiene mesa, ahora debe escanear su QR  
        //Omitimos si es PC
        if(Capacitor.getPlatform() === "web"){
          this.router.navigateByUrl(`/mesa/${mesaAsignada.id}`);
          
        } else {
          await this.installGoogleBarcodeScannerModule();
          const { barcodes } = await BarcodeScanner.scan();

          if(barcodes.length === 0){
            await this.mostrarToast("No se pudo obtener datos al escanear", "danger");
            return
          } 

          try{
             //Conversion de datos
            const qrRawData = barcodes[0].displayValue; 
            const datosMesa = JSON.parse(qrRawData);

            // Validar que sea de una mesa
            if (datosMesa.tipo !== "mesa") {
              return await this.mostrarToast("El código QR no pertenece a una mesa", "danger");
            }

            //Validar que sea la mesa asignada
            if (datosMesa.numero !== mesaAsignada.numero) {
              return await this.mostrarToast("Esta no es tu mesa.", "warning");
            }

            await this.mostrarToast("Escaneo exitoso, redirigendo al menú", "success");
            this.router.navigateByUrl(`/mesa/${mesaAsignada.id}`);  
          }catch(e:any){
            console.warn("error al escanear: "+ e.message);
          }
        }
      }

    } catch (error: any) {
      await loading.dismiss();
      console.error('Error:', error);
      await this.mostrarToast('Error al verificar tu mesa.', 'danger');
    }
  }

  async cerrarSesion() {
    await this.supabaseService.cerrarSesion();
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  private async mostrarToast(mensaje: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 3000,
      position: 'top',
      color,
      icon: color === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline'
    });
    await toast.present();
  }

  irAEstadistica() {
    this.router.navigateByUrl(`/estadistica/menu`);
  }

  //instalamos el escaner en caso de que no esté habilitado
  private async installGoogleBarcodeScannerModule() {
    if (Capacitor.getPlatform() === 'android') {
      const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!available) {
        await BarcodeScanner.installGoogleBarcodeScannerModule();
      }
    }
  }

}