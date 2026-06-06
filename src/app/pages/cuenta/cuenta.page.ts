import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { SupabaseService } from '../../services/supabase';
import { PushNotification } from '../../services/push-notifications';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Capacitor } from '@capacitor/core';

@Component({
  standalone: false,
  selector: 'app-cuenta',
  templateUrl: './cuenta.page.html',
  styleUrls: ['./cuenta.page.scss'],
})
export class CuentaPage implements OnInit {

  mesaId = '';
  numeroMesa: number | null = null;
  pedido: any = null;
  items: any[] = [];
  propinaPct = 0;
  propinaEscaneada = false;
  pagando = false;
  pagoRealizado = false;
  cargando = true;

  opcionesPropina = [
    { label: 'Excelente', pct: 20 },
    { label: 'Muy bueno', pct: 15 },
    { label: 'Bueno', pct: 10 },
    { label: 'Regular', pct: 5 },
    { label: 'Malo', pct: 0 },
  ];

  constructor(
    private route: ActivatedRoute,
    private supabase: SupabaseService,
    private push: PushNotification,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    this.mesaId = this.route.snapshot.paramMap.get('mesaId') || '';
    await this.cargarPedido();
    // Push al mozo avisando que el cliente quiere la cuenta
    try {
      await this.push.enviarPushNotificationAUsuario(
        '🧾 Solicitud de cuenta',
        `El cliente de la Mesa ${this.mesaId} está pidiendo la cuenta.`,
        'mozo@verabri.com'
      );
    } catch (e) {
      console.warn('No se pudo enviar push:', e);
    }
    await this.cargarDatosMesa();
  }

  async cargarPedido() {
    try {
      const { data, error } = await this.supabase.client
        .from('pedidos')
        .select('*, pedido_items(*, productos(*))')
        .eq('mesa_id', this.mesaId)
        .eq('estado', 'recibido')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      this.pedido = data;
      this.items = data?.pedido_items || [];
    } catch (e) {
      await this.mostrarToast('Error al cargar el pedido.', 'danger');
    } finally {
      this.cargando = false;
    }
  }

  async cargarDatosMesa() {
    try {
      const { data, error } = await this.supabase.client
        .from('mesas')
        .select('numero')
        .eq('id', this.mesaId)
        .single();

      if (error) throw error;
      this.numeroMesa = data.numero;
    } catch (e) {
      console.error('Error al cargar mesa:', e);
    } finally {
      this.cargando = false;
    }
  }

  // ── QR PROPINA ────────────────────────────────────────────────

  async escanearQRPropina() {
    if (Capacitor.getPlatform() === 'web') {
      // En web mostramos las opciones directamente
      this.propinaEscaneada = true;
      return;
    }

    try {
      const { barcodes } = await BarcodeScanner.scan();
      if (barcodes.length > 0) {
        const datos = JSON.parse(barcodes[0].rawValue ?? '{}');
        if (datos.tipo === 'propina' && datos.pct !== undefined) {
          this.propinaPct = datos.pct;
          this.propinaEscaneada = true;
          await this.mostrarToast(`Propina: ${datos.label} (${datos.pct}%)`, 'success');
        } else {
          await this.mostrarToast('QR de propina no válido.', 'danger');
          await this.supabase.vibrarError();
        }
      }
    } catch (e) {
      await this.mostrarToast('Error al escanear el QR.', 'danger');
      await this.supabase.vibrarError();
    }
  }

  seleccionarPropina(pct: number) {
    this.propinaPct = pct;
  }

  // ── CÁLCULOS ──────────────────────────────────────────────────

  get subtotal(): number {
    return this.items.reduce((acc, item) => acc + (item.precio_unit * item.cantidad), 0);
  }

  get descuentoMonto(): number {
    return this.subtotal * ((this.pedido?.descuento_pct || 0) / 100);
  }

  get propinaMonto(): number {
    return (this.subtotal - this.descuentoMonto) * (this.propinaPct / 100);
  }

  get total(): number {
    return this.subtotal - this.descuentoMonto + this.propinaMonto;
  }

  // ── PAGO SIMULADO ─────────────────────────────────────────────

  async realizarPago() {
    this.pagando = true;
    const loading = await this.loadingController.create({
      spinner: 'crescent',
      message: 'Procesando pago...',
      cssClass: 'spinner-verabri',
    });
    await loading.present();

    try {
      const { error } = await this.supabase.client
        .from('pedidos')
        .update({
          estado: 'pagado',
          propina_pct: this.propinaPct,
          total: this.total
        })
        .eq('id', this.pedido.id);

      if (error) throw error;

      // Push al mozo, dueño y supervisor
      await this.push.enviarPushNotificationAUsuario('💳 Pago listo', `Mesa ${this.numeroMesa} realizó el pago. ¡Confirmalo!`, 'mozo@verabri.com');
      await this.push.enviarPushNotificationAUsuario('💳 Pago listo', `Mesa ${this.numeroMesa} realizó el pago.`, 'dueno@verabri.com');
      await this.push.enviarPushNotificationAUsuario('💳 Pago listo', `Mesa ${this.numeroMesa} realizó el pago.`, 'supervisor@verabri.com');

      this.pagoRealizado = true;
      await this.mostrarToast('¡Pago enviado! Esperá la confirmación del mozo.', 'success');

    } catch (e) {
      await this.supabase.vibrarError();
      await this.mostrarToast('Error al procesar el pago.', 'danger');
    } finally {
      await loading.dismiss();
      this.pagando = false;
    }
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
  getQRData(op: any): string {
    return encodeURIComponent(JSON.stringify({
      tipo: 'propina',
      label: op.label,
      pct: op.pct
    }));
  }

  seleccionarPropinaDirecta(pct: number, label: string) {
    this.propinaPct = pct;
    this.propinaEscaneada = true;
    this.mostrarToast(`Propina seleccionada: ${label} (${pct}%)`, 'success');
  }
}