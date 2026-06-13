import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { SupabaseService } from '../../services/supabase';
import { PushNotification } from '../../services/push-notifications';
import jsPDF from 'jspdf';
import emailjs from '@emailjs/browser';

@Component({
  standalone: false,
  selector: 'app-pedidos-mozo',
  templateUrl: './pedidos-mozo.page.html',
  styleUrls: ['./pedidos-mozo.page.scss'],
})
export class PedidosMozoPage implements OnInit {

  pedidos: any[] = [];
  cargando = true;

  constructor(
    private router: Router,
    private supabaseService: SupabaseService,
    private pushNotification: PushNotification,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private alertController: AlertController
  ) {}

  async ngOnInit() {
    await this.cargarPedidos();
  }

  async ionViewWillEnter() {
    await this.cargarPedidos();
  }

  async cargarPedidos() {
    const loading = await this.loadingController.create({
      spinner: 'crescent',
      message: 'Cargando pedidos...',
      cssClass: 'spinner-verabri',
    });
    await loading.present();

    try {
      const { data, error } = await this.supabaseService.client
        .from('pedidos')
        .select(`
          *,
          mesas (numero),
          pedido_items (
            cantidad,
            precio_unit,
            subtotal,
            productos (nombre, tipo)
          )
        `)
        .in('estado', ['pendiente', 'rechazado', 'confirmado', 'listo', 'pagado', 'recibido'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      this.pedidos = data || [];

    } catch (error: any) {
      console.error('Error:', error);
      await this.mostrarToast('Error al cargar los pedidos.', 'danger');
    } finally {
      await loading.dismiss();
      this.cargando = false;
    }
  }

  getEstadoPreparacion(pedido: any): string {
    if (pedido.estado === 'listo') return '✅ Listo para entregar';
    if (pedido.cocina_listo && pedido.bar_listo) return '✅ Todo listo';
    if (pedido.cocina_listo) return '🍽️ Cocina lista — bar en preparación';
    if (pedido.bar_listo) return '🥤 Bar listo — cocina en preparación';
    return '🔄 En preparación';
  }

  getColorEstado(pedido: any): string {
    if (pedido.estado === 'listo') return 'success';
    if (pedido.estado === 'rechazado') return 'danger';
    if (pedido.estado === 'pendiente') return 'warning';
    if (pedido.cocina_listo || pedido.bar_listo) return 'tertiary';
    return 'primary';
  }

  async confirmarPedido(pedido: any) {
    const alert = await this.alertController.create({
      header: 'Confirmar pedido',
      message: `¿Confirmás el pedido de la Mesa ${pedido.mesas?.numero}?`,
      cssClass: 'alerta-verabri',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Confirmar',
          handler: async () => {
            await this.cambiarEstadoPedido(pedido, 'confirmado');
          }
        }
      ]
    });
    await alert.present();
  }

  async rechazarPedido(pedido: any) {
    const alert = await this.alertController.create({
      header: 'Rechazar pedido',
      message: `¿Rechazás el pedido de la Mesa ${pedido.mesas?.numero}? El cliente podrá modificarlo.`,
      cssClass: 'alerta-verabri',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Rechazar',
          handler: async () => {
            await this.cambiarEstadoPedido(pedido, 'rechazado');
          }
        }
      ]
    });
    await alert.present();
  }

  async entregarPedido(pedido: any) {
    const alert = await this.alertController.create({
      header: 'Entregar pedido',
      message: `¿Confirmás la entrega del pedido a la Mesa ${pedido.mesas?.numero}?`,
      cssClass: 'alerta-verabri',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Entregar',
          handler: async () => {
            await this.cambiarEstadoPedido(pedido, 'entregado');
          }
        }
      ]
    });
    await alert.present();
  }

  async cambiarEstadoPedido(pedido: any, estado: string) {
    const loading = await this.loadingController.create({
      spinner: 'crescent',
      message: 'Actualizando pedido...',
      cssClass: 'spinner-verabri',
    });
    await loading.present();

    try {
      const { error } = await this.supabaseService.client
        .from('pedidos')
        .update({ estado })
        .eq('id', pedido.id);

      if (error) throw error;

      if (estado === 'rechazado' && pedido.cliente_id) {
        try {
          await this.pushNotification.enviarPushNotificationPorID(
            '❌ Pedido rechazado',
            `Tu pedido de la Mesa ${pedido.mesas?.numero} fue rechazado. Podés modificarlo.`,
            pedido.cliente_id
          );
        } catch (pushError) {
          console.warn('No se pudo enviar push al cliente:', pushError);
        }
      }

      if (estado === 'confirmado') {
        try {
          await this.pushNotification.enviarPushNotificationAUsuario(
            '🍽️ Nuevo pedido confirmado',
            `Pedido de Mesa ${pedido.mesas?.numero} listo para preparar.`,
            "cocinero@verabri.com"
          );
          await this.pushNotification.enviarPushNotificationAUsuario(
            '🍽️ Nuevo pedido confirmado',
            `Pedido de Mesa ${pedido.mesas?.numero} listo para preparar.`,
            "cantinero@verabri.com"
          );
        } catch (pushError) {
          console.warn('No se pudo enviar push a cocina/bar:', pushError);
        }
      }

      if (estado === 'entregado' && pedido.cliente_id) {
        try {
          await this.pushNotification.enviarPushNotificationPorID(
            '🍽️ ¡Tu pedido llegó!',
            `El mozo entregó tu pedido en la Mesa ${pedido.mesas?.numero}. ¡Buen provecho!`,
            pedido.cliente_id
          );
        } catch (pushError) {
          console.warn('No se pudo enviar push al cliente:', pushError);
        }
      }

      const mensajes: any = {
        'confirmado': 'Pedido confirmado y enviado a cocina y bar.',
        'rechazado': 'Pedido rechazado.',
        'entregado': 'Pedido entregado al cliente.'
      };

      await this.mostrarToast(mensajes[estado] || 'Pedido actualizado.', 'success');
      await this.cargarPedidos();

    } catch (error: any) {
      console.error('Error:', error);
      await this.mostrarToast('Error al actualizar el pedido.', 'danger');
    } finally {
      await loading.dismiss();
    }
  }

  // ── GENERAR PDF ──────────────────────────────────────────────

  generarFacturaPDF(pedido: any, cliente: any): string {
    const doc = new jsPDF();
    const fecha = new Date().toLocaleDateString('es-AR');
    const numeroFactura = `F-${pedido.id.substring(0, 8).toUpperCase()}`;

    doc.setFillColor(201, 148, 58);
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(245, 238, 240);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('VERABRI', 105, 18, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Parrilla & Restaurante', 105, 26, { align: 'center' });
    doc.text('Av. Mitre 123, Avellaneda, Buenos Aires', 105, 33, { align: 'center' });

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(10);
    doc.text(`Fecha: ${fecha}`, 14, 52);
    doc.text(`N° Factura: ${numeroFactura}`, 14, 59);
    doc.text(`N° Pedido: ${pedido.id.substring(0, 8).toUpperCase()}`, 14, 66);
    doc.text(`Mesa: ${pedido.mesas?.numero}`, 14, 73);

    doc.setFillColor(107, 78, 122);
    doc.rect(0, 80, 210, 8, 'F');
    doc.setTextColor(240, 230, 211);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL CLIENTE', 14, 86);

    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Nombre: ${cliente.nombre} ${cliente.apellido || ''}`, 14, 96);
    if (cliente.email) doc.text(`Email: ${cliente.email}`, 14, 103);
    if (cliente.dni) doc.text(`DNI: ${cliente.dni}`, 14, 110);

    doc.setFillColor(107, 78, 122);
    doc.rect(0, 117, 210, 8, 'F');
    doc.setTextColor(240, 230, 211);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('DETALLE DEL PEDIDO', 14, 123);

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Producto', 14, 135);
    doc.text('Cant.', 120, 135);
    doc.text('Precio unit.', 145, 135);
    doc.text('Subtotal', 178, 135);
    doc.line(14, 137, 196, 137);

    doc.setFont('helvetica', 'normal');
    let y = 144;
    const items = pedido.pedido_items || [];
    items.forEach((item: any) => {
      doc.text(item.productos?.nombre || '', 14, y);
      doc.text(`${item.cantidad}`, 123, y);
      doc.text(`$${item.precio_unit}`, 145, y);
      doc.text(`$${item.subtotal}`, 178, y);
      y += 8;
    });

    doc.line(14, y + 2, 196, y + 2);
    y += 10;

    if (pedido.descuento_pct > 0) {
      doc.text(`Descuento (${pedido.descuento_pct}%):`, 130, y);
      const descMonto = items.reduce((acc: number, i: any) => acc + i.subtotal, 0) * pedido.descuento_pct / 100;
      doc.text(`-$${descMonto.toFixed(0)}`, 178, y);
      y += 8;
    }

    if (pedido.propina_pct > 0) {
      doc.text(`Propina (${pedido.propina_pct}%):`, 130, y);
      doc.text(`$${(pedido.total * pedido.propina_pct / 100).toFixed(0)}`, 178, y);
      y += 8;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL:', 130, y + 2);
    doc.text(`$${pedido.total}`, 178, y + 2);

    doc.setFillColor(201, 148, 58);
    doc.rect(0, 275, 210, 22, 'F');
    doc.setTextColor(245, 238, 240);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Gracias por elegirnos • VERABRI Parrilla & Restaurante', 105, 283, { align: 'center' });
    doc.text('© 2026 Verabri — UTN Avellaneda', 105, 290, { align: 'center' });

    return doc.output('datauristring');
  }

  // ── SUBIR PDF A SUPABASE STORAGE ──────────────────────────────

  async subirPDFStorage(pdfBase64: string, nombreArchivo: string): Promise<string> {
    try {
      const base64Data = pdfBase64.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const archivo = new File([blob], nombreArchivo, { type: 'application/pdf' });

      const { error } = await this.supabaseService.client.storage
        .from('fotos')
        .upload(`facturas/${nombreArchivo}`, archivo, { contentType: 'application/pdf', upsert: true });

      if (error) throw error;

      const { data } = this.supabaseService.client.storage
        .from('fotos')
        .getPublicUrl(`facturas/${nombreArchivo}`);

      return data.publicUrl;
    } catch (e) {
      console.warn('Error subiendo PDF:', e);
      return '';
    }
  }

  formatearHora(fecha: string): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
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

  // ── PUNTO 22 ──────────────────────────────────────────────────
  async confirmarPago(pedido: any) {
    const alert = await this.alertController.create({
      header: 'Confirmar pago',
      message: `¿Confirmás el pago de la Mesa ${pedido.mesas?.numero}? Se emitirá la factura.`,
      cssClass: 'alerta-verabri',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Confirmar pago',
          handler: async () => {
            const loading = await this.loadingController.create({
              spinner: 'crescent',
              message: 'Emitiendo factura...',
              cssClass: 'spinner-verabri',
            });
            await loading.present();

            try {
              const { data: clienteData } = await this.supabaseService.client
                .from('usuarios')
                .select('nombre, apellido, email, dni, perfil')
                .eq('id', pedido.cliente_id)
                .single();

              const cliente = clienteData || { nombre: 'Cliente', apellido: '', email: '', dni: '', perfil: 'cliente_anonimo' };

              const numeroFactura = `F-${pedido.id.substring(0, 8).toUpperCase()}`;
              const nombreArchivo = `factura-${numeroFactura}.pdf`;

              // Generar PDF
              const pdfBase64 = this.generarFacturaPDF(pedido, cliente);

              // Subir PDF a Supabase Storage
              const urlPDF = await this.subirPDFStorage(pdfBase64, nombreArchivo);

              // Liberar mesa
              await this.supabaseService.client
                .from('mesas')
                .update({ estado: 'vacia', cliente_id: null })
                .eq('id', pedido.mesa_id);

              // Marcar pedido como pagado
              await this.supabaseService.client
                .from('pedidos')
                .update({ estado: 'cerrado' })
                .eq('id', pedido.id);

              // Push al dueño y supervisor
              await this.pushNotification.enviarPushNotificationAUsuario(
                '✅ Pago confirmado',
                `La Mesa ${pedido.mesas?.numero} pagó y fue liberada.`,
                'dueno@verabri.com'
              );
              await this.pushNotification.enviarPushNotificationAUsuario(
                '✅ Pago confirmado',
                `La Mesa ${pedido.mesas?.numero} pagó y fue liberada.`,
                'supervisor@verabri.com'
              );

              // Cliente registrado → email con enlace PDF
              if (cliente.perfil === 'cliente_registrado' && cliente.email) {
                try {
                  const fecha = new Date().toLocaleDateString('es-AR');
                  const items = pedido.pedido_items || [];
                  const subtotal = items.reduce((acc: number, i: any) => acc + i.subtotal, 0);
                  const descuentoMonto = subtotal * (pedido.descuento_pct || 0) / 100;
                  const propinaMonto = (subtotal - descuentoMonto) * (pedido.propina_pct || 0) / 100;
                  const detalleItems = items.map((item: any) =>
                    `• ${item.productos?.nombre || ''} x${item.cantidad} — $${item.subtotal}`
                  ).join('\n');

                  await emailjs.send(
                    'verabrioff@gmail.com',
                    'template_s0lcm57',
                    {
                      email: cliente.email,
                      nombre: `${cliente.nombre} ${cliente.apellido}`,
                      numero_factura: numeroFactura,
                      numero_mesa: pedido.mesas?.numero,
                      fecha: fecha,
                      detalle_items: detalleItems,
                      subtotal: subtotal.toFixed(0),
                      descuento_pct: pedido.descuento_pct || 0,
                      descuento_monto: descuentoMonto.toFixed(0),
                      propina_pct: pedido.propina_pct || 0,
                      propina_monto: propinaMonto.toFixed(0),
                      total: pedido.total,
                      url_pdf: urlPDF
                    },
                    'BthBN2OaJ9HDcpClC'
                  );
                } catch (e) {
                  console.warn('Error enviando email factura:', e);
                }
              }

              // Cliente anónimo → push con enlace PDF
              if (pedido.cliente_id) {
                try {
                  await this.pushNotification.enviarPushNotificationPorID(
                    '🧾 Tu factura está lista',
                    `¡Gracias por tu visita! Descargá tu factura: ${urlPDF}`,
                    pedido.cliente_id
                  );
                } catch (e) {
                  console.warn('Error enviando push factura:', e);
                }
              }

              // Descargar PDF en el dispositivo del mozo
              const link = document.createElement('a');
              link.href = pdfBase64;
              link.download = nombreArchivo;
              link.click();

              await this.mostrarToast('¡Pago confirmado! Factura emitida.', 'success');
              await this.cargarPedidos();

            } catch (error: any) {
              console.error('Error:', error);
              await this.mostrarToast('Error al confirmar el pago.', 'danger');
            } finally {
              await loading.dismiss();
            }
          }
        }
      ]
    });
    await alert.present();
  }
}