import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonContent, LoadingController, ToastController } from '@ionic/angular';
import { SupabaseService } from '../../services/supabase';

@Component({
  standalone: false,
  selector: 'app-chat',
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
})
export class ChatPage implements OnInit, OnDestroy {

  @ViewChild(IonContent) contenidoScroll!: IonContent;

  mesaId: string = '';
  mensajes: any[] = [];
  nuevoMensaje: string = '';
  usuarioActual: any = null;
  nombreMesa: string = '';
  suscripcion: any = null;
  cargando = true;

  constructor(
    private route: ActivatedRoute,
    private supabaseService: SupabaseService,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    this.mesaId = this.route.snapshot.paramMap.get('mesaId') || '';
    this.usuarioActual = this.supabaseService.usuarioActual;
    await this.cargarMesa();
    await this.cargarMensajes();
    this.suscribirMensajes();
  }

  ngOnDestroy() {
    if (this.suscripcion) {
      this.suscripcion.unsubscribe();
    }
  }

  async cargarMesa() {
    const { data } = await this.supabaseService.client
      .from('mesas')
      .select('numero')
      .eq('id', this.mesaId)
      .single();

    if (data) this.nombreMesa = `Mesa ${data.numero}`;
  }

  async cargarMensajes() {
    const loading = await this.loadingController.create({
      spinner: 'crescent',
      message: 'Cargando mensajes...',
      cssClass: 'spinner-verabri',
    });
    await loading.present();

    try {
      const { data, error } = await this.supabaseService.client
        .from('mensajes')
        .select('*')
        .eq('mesa_id', this.mesaId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      this.mensajes = data || [];
      setTimeout(() => this.scrollAlFinal(), 100);

    } catch (error: any) {
      console.error('Error:', error);
      await this.mostrarToast('Error al cargar los mensajes.', 'danger');
    } finally {
      await loading.dismiss();
      this.cargando = false;
    }
  }

  suscribirMensajes() {
    this.suscripcion = this.supabaseService.client
      .channel(`mensajes-mesa-${this.mesaId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mensajes',
        filter: `mesa_id=eq.${this.mesaId}`
      }, (payload: any) => {
        const mensajeNuevo = {
          ...payload.new,
          created_at: payload.new.created_at || new Date().toISOString()
        };
        this.mensajes.push(mensajeNuevo);
        setTimeout(() => this.scrollAlFinal(), 100);
      })
      .subscribe();
  }

  async enviarMensaje() {
    if (!this.nuevoMensaje.trim()) return;

    const contenido = this.nuevoMensaje.trim();
    this.nuevoMensaje = '';

    try {
      // CORRECCIÓN: columna 'texto' en lugar de 'contenido'
      const { error } = await this.supabaseService.client
        .from('mensajes')
        .insert({
          mesa_id: this.mesaId,
          remitente_id: this.usuarioActual?.id || null,
          contenido: contenido,
          perfil_remitente: this.usuarioActual?.perfil || 'cliente',
          created_at: new Date().toISOString()

        });

      if (error) throw error;

    } catch (error: any) {
      console.error('Error:', error);
      await this.mostrarToast('No se pudo enviar el mensaje.', 'danger');
    }
  }

  esMiMensaje(mensaje: any): boolean {
    return mensaje.remitente_id === this.usuarioActual?.id;
  }

  getNombreRemitente(mensaje: any): string {
    if (this.esMiMensaje(mensaje)) return 'Yo';
    const perfil = mensaje.perfil_remitente || '';
    if (perfil === 'mozo') return 'Mozo';
    if (perfil === 'metre') return 'Metre';
    if (perfil === 'cocinero') return 'Cocinero';
    if (perfil === 'cantinero') return 'Cantinero';
    if (perfil === 'dueno') return 'Dueño';
    if (perfil === 'supervisor') return 'Supervisor';
    return 'Cliente';
  }

  formatearHora(fecha: string): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }

  scrollAlFinal() {
    if (this.contenidoScroll) {
      this.contenidoScroll.scrollToBottom(300);
    }
  }

  async mostrarToast(mensaje: string, color: 'success' | 'danger' | 'warning') {
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