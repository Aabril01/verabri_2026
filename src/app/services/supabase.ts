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

  async getUsers(){
    const {data, error} = await this.supabase.from('usuarios').select('*');
    if(error) throw error;
    return data;
  }

  async crearEmpleado(email: string, contrasena: string, datos: any) {
    // Crear en Auth
    const { data: authData, error: authError } = await this.supabase.auth.signUp({
      email,
      password: contrasena
    });
    if (authError) throw authError;

    // Insertar en tabla usuarios
    const { error: dbError } = await this.supabase
      .from('usuarios')
      .insert({
        id: authData.user?.id,
        apellido: datos.apellido,
        nombre: datos.nombre,
        dni: datos.dni,
        cuil: datos.cuil,
        email,
        perfil: datos.perfil,
        estado: 'aceptado',
        foto_url: datos.foto_url || ''
      });
    if (dbError) throw dbError;

    return authData;
  }

  /**
   * Crea un usuario 'cliente_registrado' en la tabla de usuarios. Se agrega con cuil Null y estado 'pendiente'
   * @param email Correo del cliente
   * @param contrasena Clave del cliente
   * @param datos Otros datos (nombre, apellido, dni, foto)
   * @returns 
   */
  async crearClienteRegistrado(email:string, contrasena:string, datos:any){
      const {data: authData, error: authError} = await this.supabase.auth.signUp({
        email,
        password: contrasena
      });

      if(authError) throw authError;

      const { error:dbError} = await this.supabase.from('usuarios').insert({
        id: authData.user?.id,
        apellido: datos.apellido,
        nombre: datos.nombre,
        dni: datos.dni,
        cuil: null,
        email,
        perfil: 'cliente_registrado',
        estado: 'pendiente',
        foto_url: datos.foto_url || ''
      });
      if(dbError) throw dbError;

      return authData;
  }

  /**
   * 
   * @param email correo del usuario
   * @param nuevoEstado "aceptado", "pendiente" o "rechazado"
   * @returns 
   */
  async cambiarEstado(email: string, nuevoEstado:string){
    return await this.supabase.from("usuarios").update({estado: nuevoEstado}).eq("email", email).select();
  }

  /**
   * Obtiene todos los datos de usuario por su correo
   * @param email 
   * @returns 
   */
  async traerUsuarioPorCorreo(email: string) {
    const { data, error } = await this.supabase.from('usuarios').select('*').eq('email', email).single();
    if (error) throw error;
    return data;
  }

}
