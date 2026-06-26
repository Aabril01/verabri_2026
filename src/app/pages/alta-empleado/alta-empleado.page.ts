import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { SupabaseService } from '../../services/supabase';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';

@Component({
  standalone: false,
  selector: 'app-alta-empleado',
  templateUrl: './alta-empleado.page.html',
  styleUrls: ['./alta-empleado.page.scss'],
})
export class AltaEmpleadoPage implements OnInit {

  formulario!: FormGroup;
  fotoUrl: string | null = null;
  fotoArchivo: File | null = null;
  mostrarContrasena = false;
  cargando = false;
  errorGeneral = '';
  errorFoto = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private supabaseService: SupabaseService
  ) {}

  ngOnInit() {
    this.formulario = this.fb.group({
      apellido:   ['', [Validators.required, Validators.minLength(2)]],
      nombre:     ['', [Validators.required, Validators.minLength(2)]],
      dni:        ['', [Validators.required, Validators.pattern(/^\d{7,8}$/)]],
      cuil:       ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
      email:      ['', [Validators.required, Validators.email]],
      contrasena: ['', [Validators.required, Validators.minLength(6)]],
      confirmarContrasena: ['', [Validators.required]],
      perfil:     ['cocinero', Validators.required]
    }, { validators: this.contrasenasIgualesValidator });
  }

  // NUEVO: valida que "Repetir contraseña" coincida con "Contraseña"
  private contrasenasIgualesValidator(group: AbstractControl): ValidationErrors | null {
    const contrasena = group.get('contrasena')?.value;
    const confirmacion = group.get('confirmarContrasena')?.value;
    const controlConfirmacion = group.get('confirmarContrasena');

    if (contrasena && confirmacion && contrasena !== confirmacion) {
      controlConfirmacion?.setErrors({ ...controlConfirmacion.errors, noCoincide: true });
    } else if (controlConfirmacion?.hasError('noCoincide')) {
      const errores = { ...controlConfirmacion.errors };
      delete errores['noCoincide'];
      controlConfirmacion.setErrors(Object.keys(errores).length ? errores : null);
    }
    return null;
  }

  campoInvalido(campo: string): boolean {
    const control = this.formulario.get(campo);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  toggleContrasena() {
    this.mostrarContrasena = !this.mostrarContrasena;
  }

  // ── FOTO ──────────────────────────────────────────────────────

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

  // ── QR DNI ────────────────────────────────────────────────────

  async escanearQRDni() {
    try {
      if (Capacitor.getPlatform() === 'web') {
        await this.mostrarToast('Esta función solo funciona en dispositivos Android.', 'warning');
        return;
      }

      const { camera } = await BarcodeScanner.requestPermissions();
      if (camera === 'denied') {
        await this.mostrarToast('El acceso a la cámara fue denegado.', 'danger');
        return;
      }

      if (Capacitor.getPlatform() === 'android') {
        const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        if (!available) {
          await BarcodeScanner.installGoogleBarcodeScannerModule();
        }
      }

      const { barcodes } = await BarcodeScanner.scan({
        formats: [BarcodeFormat.Pdf417, BarcodeFormat.QrCode]
      });

      if (!barcodes || barcodes.length === 0) {
        await this.mostrarToast('No se detectó ningún código.', 'danger');
        return;
      }

      const raw = barcodes[0].rawValue || '';
      const parsed = this.parseDNIQr(raw);

      if (!parsed || !parsed.dni || !parsed.nombre || !parsed.apellido) {
        await this.mostrarToast('No se pudo interpretar el código del DNI.', 'danger');
        return;
      }

      const { nombre, apellido, dni } = parsed;
      if (!this.formulario.get('nombre')?.value) this.formulario.get('nombre')?.setValue(nombre);
      if (!this.formulario.get('apellido')?.value) this.formulario.get('apellido')?.setValue(apellido);
      if (!this.formulario.get('dni')?.value) this.formulario.get('dni')?.setValue(dni);

      await this.mostrarToast('Datos del DNI cargados correctamente.', 'success');

    } catch (e: any) {
      await this.mostrarToast('Error al abrir el escáner.', 'danger');
    }
  }

  private parseDNIQr(raw: string): { nombre: string; apellido: string; dni: string } | null {
    const parts = raw.split('@').map(s => s?.trim() || '');
    const DNI_REGEX = /^\d{7,8}$/;

    if (parts.length >= 6) {
      const apellido = this.capitalizar(parts[1]);
      const nombre = this.capitalizar(parts[2]);
      const dni = (parts[4] || '').replace(/\D/g, '');
      if (apellido && nombre && DNI_REGEX.test(dni)) {
        return { nombre, apellido, dni };
      }
    }
    return null;
  }

  private capitalizar(s: string) {
    return s.toLowerCase().split(' ').filter(Boolean)
      .map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  }

  // ── GUARDAR ───────────────────────────────────────────────────

  async guardarEmpleado() {
    this.formulario.markAllAsTouched();

    if (!this.fotoUrl) {
      this.errorFoto = 'La foto del empleado es obligatoria.';
      await this.vibrarError();
      return;
    }

    if (this.formulario.invalid) {
      await this.vibrarError();
      return;
    }

    this.cargando = true;
    this.errorGeneral = '';

    const loading = await this.loadingController.create({
      spinner: 'crescent',
      message: 'Guardando empleado...',
      cssClass: 'spinner-verabri',
    });
    await loading.present();

    try {
      const { apellido, nombre, dni, cuil, email, contrasena, perfil } = this.formulario.value;

      let fotoStorageUrl = '';
      if (this.fotoArchivo) {
        fotoStorageUrl = await this.supabaseService.subirFoto(this.fotoArchivo, 'empleados');
      } else if (this.fotoUrl) {
        const response = await fetch(this.fotoUrl);
        const blob = await response.blob();
        const archivo = new File([blob], `empleado-${Date.now()}.jpg`, { type: 'image/jpeg' });
        fotoStorageUrl = await this.supabaseService.subirFoto(archivo, 'empleados');
      }

      await this.supabaseService.crearEmpleado(email, contrasena, {
        apellido, nombre, dni, cuil, perfil, foto_url: fotoStorageUrl
      });

      await this.mostrarToast('¡Empleado registrado correctamente!', 'success');
      this.router.navigateByUrl('/home', { replaceUrl: true });

    } catch (error: any) {
      await this.vibrarError();
      this.errorGeneral = 'No se pudo guardar el empleado. Verificá los datos e intentá nuevamente.';
    } finally {
      await loading.dismiss();
      this.cargando = false;
    }
  }

  private async vibrarError() {
    await this.supabaseService.vibrarError();
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