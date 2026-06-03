import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';

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
  nombreTercero = 'Llopi, Gabriel';

  private intervalProgreso: any;

  constructor(
    private router: Router,
    private supabaseService: SupabaseService
  ) {}

  async ngOnInit() {
    setTimeout(() => { this.animacionIniciada = true; }, 100);
    this.animarProgreso();
    setTimeout(async () => { await this.verificarSesion(); }, 3500);
  }

  ngOnDestroy() {
    if (this.intervalProgreso) clearInterval(this.intervalProgreso);
  }

  private animarProgreso() {
    const mensajes = ['Iniciando...', 'Cargando menú...', 'Conectando con el servidor...', 'Preparando la experiencia...', '¡Bienvenidos a Verabri!'];
    let paso = 0;
    this.intervalProgreso = setInterval(() => {
      this.progreso += 20;
      this.mensajeCarga = mensajes[paso] || '¡Bienvenidos a Verabri!';
      paso++;
      if (this.progreso >= 100) clearInterval(this.intervalProgreso);
    }, 600);
  }

  private async verificarSesion() {
    try {
      const sesion = await this.supabaseService.obtenerSesion();
      if (sesion) {
        const usuario = await this.supabaseService.cargarPerfil(sesion.user.id);
        this.router.navigateByUrl('/home', { replaceUrl: true });
      } else {
        this.router.navigateByUrl('/login', { replaceUrl: true });
      }
    } catch (error) {
      this.router.navigateByUrl('/login', { replaceUrl: true });
    }
  }
}