// src/app/pages/splash/splash.page.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';

// Descomenta cuando tengas Capacitor instalado:
// import { Haptics } from '@capacitor/haptics';
// import { NativeAudio } from '@capacitor-community/native-audio';

@Component({
  standalone: false,
  selector: 'app-splash',
  templateUrl: './splash.page.html',
  styleUrls: ['./splash.page.scss'],
})
export class SplashPage implements OnInit, OnDestroy {

  animacionIniciada = false;
  progreso = 0;
  mensajeCarga = 'Iniciando...';
  nombreTercero = 'Gabriel Llopi';

  private intervalProgreso: any;

  constructor(
    private router: Router,
    private supabaseService: SupabaseService
  ) {}

  async ngOnInit() {
    // Reproducir sonido de inicio
    await this.reproducirSonidoInicio();

    // Pequeño delay antes de animar
    setTimeout(() => {
      this.animacionIniciada = true;
    }, 100);

    // Iniciar la barra de progreso con mensajes
    this.animarProgreso();

    // Verificar si ya hay sesión activa
    setTimeout(async () => {
      await this.verificarSesion();
    }, 3500);
  }

  ngOnDestroy() {
    if (this.intervalProgreso) {
      clearInterval(this.intervalProgreso);
    }
  }

  private animarProgreso() {
    const mensajes = [
      'Iniciando...',
      'Cargando menú...',
      'Conectando con el servidor...',
      'Preparando la experiencia...',
      '¡Bienvenidos a Verabri!'
    ];

    let paso = 0;
    this.intervalProgreso = setInterval(() => {
      this.progreso += 20;
      this.mensajeCarga = mensajes[paso] || '¡Bienvenidos a Verabri!';
      paso++;
      if (this.progreso >= 100) {
        clearInterval(this.intervalProgreso);
      }
    }, 600);
  }

  private async verificarSesion() {
    try {
      const sesion = await this.supabaseService.obtenerSesion();
      if (sesion) {
        // Hay sesión activa → ir al home del perfil correspondiente
        const usuario = await this.supabaseService.cargarPerfil(sesion.user.id);
        this.navegarSegunPerfil(usuario.perfil);
      } else {
        // Sin sesión → ir al login
        this.router.navigateByUrl('/login', { replaceUrl: true });
      }
    } catch (error) {
      this.router.navigateByUrl('/login', { replaceUrl: true });
    }
  }

  private navegarSegunPerfil(perfil: string) {
    const rutas: { [key: string]: string } = {
      dueno: '/home/dueno',
      supervisor: '/home/supervisor',
      metre: '/home/metre',
      mozo: '/home/mozo',
      cocinero: '/home/cocinero',
      cantinero: '/home/cantinero',
      cliente_registrado: '/home/cliente',
      cliente_anonimo: '/home/cliente'
    };
    const ruta = rutas[perfil] || '/home';
    this.router.navigateByUrl(ruta, { replaceUrl: true });
  }

  private async reproducirSonidoInicio() {
    // Con Capacitor Native Audio instalado:
    // try {
    //   await NativeAudio.preload({ assetId: 'inicio', assetPath: 'assets/sounds/inicio.mp3', audioChannelNum: 1, isUrl: false });
    //   await NativeAudio.play({ assetId: 'inicio' });
    // } catch (e) {
    //   console.log('Audio no disponible en este entorno');
    // }
    console.log('🎵 Sonido de inicio reproducido');
  }
}
