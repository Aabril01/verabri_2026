// src/app/services/supabase.service.ts
import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {

  private supabase: SupabaseClient;
  private _usuarioActual = new BehaviorSubject<any>(null);
  usuarioActual$ = this._usuarioActual.asObservable();

  constructor() {
    this.supabase = createClient(
      environment.supabase.url,
      environment.supabase.key
    );

    // Escuchar cambios de sesión
    this.supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        this.cargarPerfil(session.user.id);
      } else {
        this._usuarioActual.next(null);
      }
    });
  }

  // ── AUTENTICACIÓN ──────────────────────────────────────────────

  async iniciarSesion(email: string, contrasena: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password: contrasena
    });
    if (error) throw error;
    return data;
  }

  async cerrarSesion() {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
    this._usuarioActual.next(null);
    // Limpiar cualquier dato local
    localStorage.clear();
    sessionStorage.clear();
  }

  async obtenerSesion() {
    const { data } = await this.supabase.auth.getSession();
    return data.session;
  }

  // ── PERFIL ─────────────────────────────────────────────────────

  async cargarPerfil(userId: string) {
    const { data, error } = await this.supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    this._usuarioActual.next(data);
    return data;
  }

  get usuarioActual() {
    return this._usuarioActual.getValue();
  }

  // ── VERIFICAR ESTADO DEL CLIENTE ───────────────────────────────

  async verificarEstadoCliente(userId: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('usuarios')
      .select('estado')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data?.estado || 'pendiente';
  }

  // ── CONSULTAS GENERALES ────────────────────────────────────────

  get client(): SupabaseClient {
    return this.supabase;
  }
}
