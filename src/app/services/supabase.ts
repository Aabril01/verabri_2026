// src/app/services/supabase.service.ts
import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { BehaviorSubject } from 'rxjs';
import { NativeAudio } from '@capacitor-community/native-audio';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import emailjs from '@emailjs/browser';

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
      environment.supabase.key,
      {
        auth: {
          // Por defecto, supabase-js usa navigator.locks para evitar que
          // varias pestañas/instancias se peleen renovando la sesión al
          // mismo tiempo. En el WebView de Android esto puede colgarse
          // para siempre esperando un candado que nunca se libera
          // (NavigatorLockAcquireTimeoutError) — lo vimos pasar
          // específicamente en el flujo del cliente anónimo, que es quien
          // más rápido y seguido dispara chequeos de sesión sin tener una
          // sesión real de Auth. Reemplazamos el candado por un "no-op"
          // que ejecuta la función directamente, sin esperar nada.
          lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
            return await fn();
          }
        }
      }
    );

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
    try {
      await NativeAudio.play({ assetId: 'cierre' });
    } catch (e) {}
    
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
    this._usuarioActual.next(null);
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

  async getUsers() {
    const { data, error } = await this.supabase
      .from('usuarios')
      .select('*')
      .eq('estado', 'pendiente')
      .eq('perfil', 'cliente_registrado');
    if (error) throw error;
    return data;
  }

  async crearEmpleado(email: string, contrasena: string, datos: any) {
    const { data: authData, error: authError } = await this.supabase.auth.signUp({
      email,
      password: contrasena
    });
    if (authError) throw authError;

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

  async crearClienteRegistrado(email: string, contrasena: string, datos: any) {
    const { data: authData, error: authError } = await this.supabase.auth.signUp({
      email,
      password: contrasena
    });
    if (authError) throw authError;

    const { error: dbError } = await this.supabase.from('usuarios').insert({
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
    if (dbError) throw dbError;

    return authData;
  }

  async cambiarEstado(email: string, nuevoEstado: string) {
    return await this.supabase
      .from('usuarios')
      .update({ estado: nuevoEstado })
      .eq('email', email)
      .select();
  }

  async traerUsuarioPorCorreo(email: string) {
    const { data, error } = await this.supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .single();
    if (error) throw error;
    return data;
  }

  async subirFoto(archivo: File, carpeta: string): Promise<string> {
    const extension = archivo.name.split('.').pop();
    const nombre = `${carpeta}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${extension}`;

    const { error } = await this.supabase.storage
      .from('fotos')
      .upload(nombre, archivo);

    if (error) throw error;

    const { data } = this.supabase.storage
      .from('fotos')
      .getPublicUrl(nombre);

    return data.publicUrl;
  }

  // ── EMAIL AUTOMÁTICO ───────────────────────────────────────────

  async enviarEmailEstado(email: string, nombre: string, estado: string): Promise<void> {
    const estadoTexto = estado === 'aceptado' ? 'aprobada' : 'rechazada';
    const colorEstado = estado === 'aceptado' ? '#2A8C50' : '#C0392B';
    const detalle = estado === 'aceptado'
      ? 'Ya podés ingresar a la aplicación.'
      : 'Si creés que es un error, comunicate con el restaurante.';

    try {
      await emailjs.send(
        'verabrioff@gmail.com',
        'template_gn0l3c7',
        { email, nombre, estado: estadoTexto, color: colorEstado, detalle },
        'BthBN2OaJ9HDcpClC'
      );
    } catch (e) {
      console.warn('EmailJS:', e);
    }
  }
  async vibrarError() {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch (e) {}
  }
}