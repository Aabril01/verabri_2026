// src/app/pages/login/login.page.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { SupabaseService } from '../../services/supabase';

// Descomenta cuando tengas Capacitor instalado:
// import { Haptics, ImpactStyle } from '@capacitor/haptics';
// import { NativeAudio } from '@capacitor-community/native-audio';

interface PerfilRapido {
  id: string;
  nombre: string;
  icono: string;
  email: string;
  contrasena: string;
}

@Component({
  standalone: false,
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {

  formularioLogin!: FormGroup;
  cargando = false;
  mostrarContrasena = false;
  errorGeneral = '';
  perfilCargando: string | null = null;

  // ── PERFILES PARA ACCESO RÁPIDO ───────────────────────────────
  // IMPORTANTE: reemplazar emails/contraseñas con los reales en Supabase
  perfilesRapidos: PerfilRapido[] = [
    { id: 'dueno',             nombre: 'Dueño',             icono: 'business-outline',    email: 'dueno@verabri.com',    contrasena: 'Verabri2026!' },
    { id: 'supervisor',        nombre: 'Supervisor',        icono: 'shield-outline',      email: 'supervisor@verabri.com', contrasena: 'Verabri2026!' },
    { id: 'metre',             nombre: 'Metre',             icono: 'people-outline',      email: 'metre@verabri.com',    contrasena: 'Verabri2026!' },
    { id: 'mozo',              nombre: 'Mozo',              icono: 'restaurant-outline',  email: 'mozo@verabri.com',     contrasena: 'Verabri2026!' },
    { id: 'cocinero',          nombre: 'Cocinero',          icono: 'flame-outline',       email: 'cocinero@verabri.com', contrasena: 'Verabri2026!' },
    { id: 'cantinero',         nombre: 'Cantinero',         icono: 'wine-outline',        email: 'cantinero@verabri.com', contrasena: 'Verabri2026!' },
    { id: 'cliente_registrado',nombre: 'Cliente',           icono: 'person-outline',      email: 'cliente@verabri.com',  contrasena: 'Verabri2026!' },
    { id: 'cliente_anonimo',   nombre: 'Anónimo',           icono: 'help-circle-outline', email: 'anonimo@verabri.com',  contrasena: 'Verabri2026!' },
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private supabaseService: SupabaseService
  ) {}

  ngOnInit() {
    this.construirFormulario();
    this.precargarSonidos();
  }

  // ── FORMULARIO ────────────────────────────────────────────────

  private construirFormulario() {
    this.formularioLogin = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      contrasena: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  campoInvalido(campo: string): boolean {
    const control = this.formularioLogin.get(campo);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  toggleContrasena() {
    this.mostrarContrasena = !this.mostrarContrasena;
  }

  // ── INICIO DE SESIÓN MANUAL ───────────────────────────────────

  async iniciarSesion() {
    // Marcar todos los campos como tocados para mostrar errores
    this.formularioLogin.markAllAsTouched();

    if (this.formularioLogin.invalid) {
      await this.vibrarError();
      return;
    }

    this.cargando = true;
    this.errorGeneral = '';

    const loading = await this.loadingController.create({
      spinner: 'crescent',
      message: 'Verificando credenciales...',
      cssClass: 'spinner-verabri',
      backdropDismiss: false
    });
    await loading.present();

    try {
      const { email, contrasena } = this.formularioLogin.value;
      await this.supabaseService.iniciarSesion(email, contrasena);

      const usuario = this.supabaseService.usuarioActual;

      // Verificar si el cliente fue aceptado
      if (usuario?.perfil === 'cliente_registrado' && usuario?.estado !== 'aceptado') {
        await this.supabaseService.cerrarSesion();
        const mensaje = usuario.estado === 'rechazado'
          ? 'Tu solicitud de registro fue rechazada. Por favor contactate con el restaurante.'
          : 'Tu cuenta está pendiente de aprobación. Te notificaremos por correo electrónico.';
        this.errorGeneral = mensaje;
        await this.vibrarError();
        return;
      }

      await this.mostrarToast('¡Bienvenido a Verabri!', 'success');
      this.navegarSegunPerfil(usuario?.perfil);

    } catch (error: any) {
      await this.vibrarError();
      this.errorGeneral = this.traducirError(error?.message || '');
    } finally {
      await loading.dismiss();
      this.cargando = false;
    }
  }

  // ── ACCESO RÁPIDO POR PERFIL ──────────────────────────────────

  async accesoRapido(perfil: PerfilRapido) {
    this.perfilCargando = perfil.id;
    this.errorGeneral = '';

    // Rellenar el formulario visualmente
    this.formularioLogin.patchValue({
      email: perfil.email,
      contrasena: perfil.contrasena
    });

    try {
      await this.supabaseService.iniciarSesion(perfil.email, perfil.contrasena);
      const usuario = this.supabaseService.usuarioActual;
      await this.mostrarToast(`Ingresando como ${perfil.nombre}`, 'success');
      this.navegarSegunPerfil(usuario?.perfil || perfil.id);
    } catch (error: any) {
      await this.vibrarError();
      this.errorGeneral = `No se pudo ingresar como ${perfil.nombre}. Verificá que el usuario exista en Supabase.`;
    } finally {
      this.perfilCargando = null;
    }
  }

  // ── NAVEGACIÓN POR PERFIL ─────────────────────────────────────

  private navegarSegunPerfil(perfil: string) {
    this.router.navigateByUrl('/home', { replaceUrl: true });
  }

  // ── CIERRE DE SESIÓN ──────────────────────────────────────────
  // (Este método se llama desde el home, pero se declara en el servicio)
  // Ver home.page.ts para la implementación del botón de cierre.

  // ── UTILIDADES ────────────────────────────────────────────────

  private async vibrarError() {
    // Con Capacitor instalado:
    // await Haptics.impact({ style: ImpactStyle.Medium });
    console.log('📳 Vibración de error');
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

  private traducirError(mensaje: string): string {
    if (mensaje.includes('Invalid login credentials'))
      return 'El correo electrónico o la contraseña son incorrectos.';
    if (mensaje.includes('Email not confirmed'))
      return 'Debés confirmar tu correo electrónico antes de ingresar.';
    if (mensaje.includes('Too many requests'))
      return 'Demasiados intentos fallidos. Esperá unos minutos e intentá nuevamente.';
    return 'Ocurrió un error al intentar ingresar. Verificá tu conexión e intentá nuevamente.';
  }

  private async precargarSonidos() {
    // Con @capacitor-community/native-audio instalado:
    // try {
    //   await NativeAudio.preload({ assetId: 'inicio', assetPath: 'assets/sounds/inicio.mp3', audioChannelNum: 1, isUrl: false });
    //   await NativeAudio.preload({ assetId: 'cierre', assetPath: 'assets/sounds/cierre.mp3', audioChannelNum: 1, isUrl: false });
    // } catch(e) {}
  }
}
