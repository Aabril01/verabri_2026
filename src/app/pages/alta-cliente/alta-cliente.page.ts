import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { SupabaseService } from 'src/app/services/supabase';
import { Camera, CameraResultType, CameraSource, CameraPermissionType} from '@capacitor/camera'
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';

const DNI_REGEX = /^\d{7,8}$/;

@Component({
  standalone: false,
  selector: 'app-alta-cliente',
  templateUrl: './alta-cliente.page.html',
  styleUrls: ['./alta-cliente.page.scss'],
})
export class AltaClientePage implements OnInit {

  formulario!: FormGroup;
  fotoUrl: string | null = null;
  fotoArchivo: File | null = null;
  mostrarContrasena = false;
  cargando = false;
  errorGeneral = '';
  errorFoto = '';
  qrVerified = false;
  qrDataPreview: { nombre?: string; apellido?: string; dni?: string } = {};

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private supabaseService: SupabaseService
  ) { }

  ngOnInit() {
    this.formulario = this.fb.group({
      apellido: ['', [Validators.required, Validators.minLength(2)]],
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      dni: ['', [Validators.required, Validators.pattern(/^\d{7,8}$/)]],
      email: ['', [Validators.required, Validators.email]],
      contrasena: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  get f() { return this.formulario.controls; }

  campoInvalido(campo:string): boolean{
    const control = this.formulario.get(campo);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  toggleContrasena(){
    this.mostrarContrasena = !this.mostrarContrasena;
  }

  // ── Foto ──────────────────────────────────────────────────────
  async seleccionarFoto(){
    try{
      const image = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });
      this.fotoUrl = image.dataUrl ?? null;
      this.fotoArchivo = image.exif
    } catch {
      this.mostrarToast('No se ha tomado ninguna foto.', 'warning');
    }
    
  }

  // ── MENSAJES TOAST ──────────────────────────────────────────────────────

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

  private async vibrarError(){
    console.log('Brrr, Brrr, vibración por un error');
  }

  // ── GUARDADO DE DATOS ──────────────────────────────────────────────────────

  async guardarCliente(){
    this.formulario.markAllAsTouched();

    if(!this.fotoUrl){
      this.errorFoto = 'Es necesaria una foto del cliente.';
      await this.vibrarError();
      return;
    }

    if(this.formulario.invalid){
      await this.vibrarError();
      return;
    }

    this.cargando = true; 
    this.errorGeneral = '';

    const loading = await this.loadingController.create({
      spinner: 'crescent',
      message: 'Guardando los datos...',
      cssClass: 'spinner-verabri',
    });
    await loading.present();

    try{
      const { apellido, nombre, dni, email, contrasena} = this.formulario.value;
      
      await this.supabaseService.crearClienteRegistrado(email, contrasena, {
        apellido, nombre, dni, foto_url: this.fotoUrl    
      });
       
      await this.mostrarToast('Fuiste registrado con éxito. Espera a que validen tu cuenta.', 'success');
      this.router.navigateByUrl('/login', {replaceUrl:true});

    } catch (error:any){
      await this.vibrarError();
      this.errorGeneral = 'Ocurrió un error al registrar. Verifica los datos e intenta nuevamente.'
      
    } finally {
      await loading.dismiss();
      this.cargando = false;
    }
  }

// ── LECTURA DNI ──────────────────────────────────────────────────────

  /**
   * Escanea el código de barras del DNI. Rellena el nombre, apellido y dni del form automáticamente.
   */
  async escanearQRDni(){
    try{
      if(Capacitor.getPlatform() === 'web'){
        this.mostrarToast('Esta función solo funciona en dispositivos android', 'warning');
        return;
      }

      const { camera } = await BarcodeScanner.requestPermissions();
      if (camera === 'denied') {
        this.mostrarToast('El acceso a la cámara fue denegado.', 'danger');
        // Opcional: Abrir configuración del sistema si es necesario
        return;
      }
      if (camera !== 'granted' && camera !== 'limited') {
        this.mostrarToast('No se otorgaron los permisos necesarios.', 'warning');
        return;
      }

      if (Capacitor.getPlatform() === 'android') {
        await this.ensureBarcodeModule();
      }

      const { barcodes } = await BarcodeScanner.scan({
        formats: [BarcodeFormat.Pdf417, BarcodeFormat.QrCode]
      });

      if(!barcodes || barcodes.length === 0){
        this.mostrarToast('No se detectó ningún código', 'danger');
        return;
      }

      const raw = barcodes[0].rawValue || '';
      const parsed = this.parseDNIQr(raw);

      if (!parsed || !parsed.dni || !parsed.nombre || !parsed.apellido) {
        this.mostrarToast('No se pudo interpretar el código del DNI.', 'danger');
        this.qrVerified = false;
        this.qrDataPreview = {};
        return;
      }

      const {nombre, apellido, dni} = parsed;
      const datosActuales = this.formulario.value;

      if(!datosActuales.nombre){this.f['nombre'].setValue(nombre)}
      if(!datosActuales.apellido){this.f['apellido'].setValue(apellido)}
      if(!datosActuales.dni){this.f['dni'].setValue(dni)}

      const matchNombre = this.norm(datosActuales.nombre || nombre) === this.norm(nombre);
      const matchApellido = this.norm(datosActuales.apellido || apellido) === this.norm(apellido);
      const matchDni = (datosActuales.dni || dni)?.toString() === dni.toString();

      this.qrVerified = matchNombre && matchApellido && matchDni;
      this.qrDataPreview = { nombre, apellido, dni };
      this.mostrarToast(this.qrVerified ? 'Datos completados.' : 'Error al completar datos.', 'success');
    } catch (e:any){
      this.mostrarToast('Error al abrir el escáner.', 'danger');
      this.qrVerified = false;
      this.qrDataPreview = {};
    }
  }

  private async ensureBarcodeModule() {
    try {
      // @ts-ignore
      const isAvail = await (BarcodeScanner as any).isGoogleBarcodeScannerModuleAvailable?.();
      if (isAvail?.available === false || isAvail === false) {
        // @ts-ignore
        await (BarcodeScanner as any).installGoogleBarcodeScannerModule?.();
        this.mostrarToast('Módulo de lectura de códigos instalado.', 'success');
      }
    } catch {}
  }

  // ── Normalización de los datos DNI ──────────────────────────────────────────────────────

  private parseDNIQr(raw: string): { nombre: string; apellido: string; dni: string } | null {
    const parts = raw.split('@').map(s => s?.trim() || '');

    if (parts.length >= 6) {
      const apellido = this.capitalizar(parts[1]);
      const nombre = this.capitalizar(parts[2]);
      const dni = (parts[4] || '').replace(/\D/g, '');
      if (apellido && nombre && DNI_REGEX.test(dni)) {
        return { nombre, apellido, dni };
      }
    }

    const dniIdx = parts.findIndex(p => DNI_REGEX.test(p));
    if (dniIdx !== -1) {
      const dni = parts[dniIdx];
      const apellido = this.capitalizar(parts[dniIdx - 3] || parts[dniIdx - 2] || '');
      const nombre = this.capitalizar(parts[dniIdx - 2] || parts[dniIdx - 1] || '');
      if (apellido && nombre) return { nombre, apellido, dni };
    }

    return null;
  }

  private capitalizar(s: string) {
    return s
      .toLowerCase()
      .split(' ')
      .filter(Boolean)
      .map(w => w[0].toUpperCase() + w.slice(1))
      .join(' ');
  }

  private norm(s: string) {
    return (s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zñ ]/g, '')
      .trim();
  }

}
