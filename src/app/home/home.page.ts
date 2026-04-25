import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../services/supabase';

@Component({
  standalone: false,
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit {

  perfil: string = '';
  nombre: string = '';

  constructor(
    private router: Router,
    private supabaseService: SupabaseService
  ) {}

  async ngOnInit() {
    const sesion = await this.supabaseService.obtenerSesion();
    if (sesion) {
      const usuario = await this.supabaseService.cargarPerfil(sesion.user.id);
      this.perfil = usuario?.perfil || '';
      this.nombre = usuario?.nombre || '';
    }
  }

  async cerrarSesion() {
    await this.supabaseService.cerrarSesion();
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}