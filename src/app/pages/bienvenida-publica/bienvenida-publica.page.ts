import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';
import { LoadingController, ToastController } from '@ionic/angular';
import { Chart, registerables } from 'chart.js';
import { PushNotification } from '../../services/push-notifications';

Chart.register(...registerables);

@Component({
  standalone: false,
  selector: 'app-bienvenida-publica',
  templateUrl: './bienvenida-publica.page.html',
  styleUrls: ['./bienvenida-publica.page.scss'],
})
export class BienvenidaPublicaPage implements OnInit {

  @ViewChild('barCanvas', { static: false }) barCanvas!: ElementRef;
  @ViewChild('pieCanvas', { static: false }) pieCanvas!: ElementRef;
  @ViewChild('lineCanvas', { static: false }) lineCanvas!: ElementRef;

  cargando = true;
  totalEncuestas = 0;
  valoracionGeneral = 0;
  porcentajeVolveria = 0;
  graficaActiva = 'barra';
  calificaciones: number[] = [];
  pComida = 0;
  pServicio = 0;
  pLimpieza = 0;
  chartBar: any;
  chartPie: any;
  chartLine: any;
  tienedatos = false;

  constructor(
    private router: Router,
    private supabase: SupabaseService,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private pushNotifications: PushNotification
  ) {}

  async ngOnInit() {
    const nombre = sessionStorage.getItem('anonimo_nombre');
    this.tienedatos = !!nombre;
    await this.cargarEstadisticas();
  }

  cambiarGrafica(evento: any) {
    this.graficaActiva = evento.detail.value;
    setTimeout(() => {
      if (this.graficaActiva === 'barra') this.generarGraficoBarra();
      else if (this.graficaActiva === 'torta') this.generarGraficoTorta();
      else if (this.graficaActiva === 'lineal') this.generarGraficoLineal();
    }, 100);
  }

  async cargarEstadisticas() {
    try {
      const { data: encuestas } = await this.supabase.client
        .from('encuestas')
        .select('*');

      if (encuestas && encuestas.length > 0) {
        this.totalEncuestas = encuestas.length;
        const sumaCalificacion = encuestas.reduce((acc, curr) => acc + curr.calificacion, 0);
        this.valoracionGeneral = Number((sumaCalificacion / this.totalEncuestas).toFixed(1));
        const cuantosVolverian = encuestas.filter(e => e.volveria === true).length;
        this.porcentajeVolveria = Math.round((cuantosVolverian / this.totalEncuestas) * 100);
        this.calificaciones = encuestas.map(e => e.calificacion);

        let sumaComida = 0, sumaServicio = 0, sumaLimpieza = 0;
        encuestas.forEach(e => {
          sumaComida += e.aspectos?.comida || 0;
          sumaServicio += e.aspectos?.servicio || 0;
          sumaLimpieza += e.aspectos?.limpieza || 0;
        });
        this.pComida = Number((sumaComida / this.totalEncuestas).toFixed(1));
        this.pServicio = Number((sumaServicio / this.totalEncuestas).toFixed(1));
        this.pLimpieza = Number((sumaLimpieza / this.totalEncuestas).toFixed(1));
      }
    } catch (e) {
      console.error('Error cargando estadísticas:', e);
    } finally {
      this.cargando = false;
      setTimeout(() => this.generarGraficoBarra(), 100);
    }
  }

  generarGraficoBarra() {
    if (!this.barCanvas?.nativeElement) { setTimeout(() => this.generarGraficoBarra(), 50); return; }
    if (this.chartBar) this.chartBar.destroy();
    this.chartBar = new Chart(this.barCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: ['Comida', 'Servicio', 'Limpieza'],
        datasets: [{
          label: 'Puntaje Promedio',
          data: [this.pComida, this.pServicio, this.pLimpieza],
          backgroundColor: ['rgba(201,148,58,0.7)', 'rgba(107,78,122,0.7)', 'rgba(75,192,192,0.7)'],
          borderColor: ['#C9943A', '#6B4E7A', '#4bc1c0'],
          borderWidth: 1.5
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, max: 5, ticks: { stepSize: 1, color: '#F0E6D3' } },
          x: { ticks: { color: '#F0E6D3' } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  generarGraficoTorta() {
    if (!this.pieCanvas?.nativeElement) { setTimeout(() => this.generarGraficoTorta(), 50); return; }
    if (this.chartPie) this.chartPie.destroy();
    const conteo = [0, 0, 0, 0, 0];
    this.calificaciones.forEach(c => { if (c >= 1 && c <= 5) conteo[c - 1]++; });
    this.chartPie = new Chart(this.pieCanvas.nativeElement, {
      type: 'pie',
      data: {
        labels: ['⭐ 1', '⭐⭐ 2', '⭐⭐⭐ 3', '⭐⭐⭐⭐ 4', '⭐⭐⭐⭐⭐ 5'],
        datasets: [{
          data: conteo,
          backgroundColor: ['rgba(192,57,43,0.7)', 'rgba(230,126,34,0.7)', 'rgba(251,188,5,0.7)', 'rgba(75,192,192,0.7)', 'rgba(42,140,80,0.7)'],
          borderColor: ['#c0392b', '#e67e22', '#fbbc05', '#4bc1c0', '#2a8c50'],
          borderWidth: 1.5
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#F0E6D3' } } }
      }
    });
  }

  generarGraficoLineal() {
    if (!this.lineCanvas?.nativeElement) { setTimeout(() => this.generarGraficoLineal(), 50); return; }
    if (this.chartLine) this.chartLine.destroy();
    this.chartLine = new Chart(this.lineCanvas.nativeElement, {
      type: 'line',
      data: {
        labels: this.calificaciones.map((_, i) => `Encuesta ${i + 1}`),
        datasets: [{
          label: 'Calificación',
          data: this.calificaciones,
          borderColor: '#C9943A',
          backgroundColor: 'rgba(201,148,58,0.2)',
          pointBackgroundColor: '#C9943A',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, max: 5, ticks: { stepSize: 1, color: '#F0E6D3' } },
          x: { ticks: { color: '#F0E6D3' } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  async irAListaEspera() {
    const nombre = sessionStorage.getItem('anonimo_nombre');
    const fotoUrl = sessionStorage.getItem('anonimo_foto_url');

    // Si no tiene datos, ir a registrarse
    if (!nombre || !fotoUrl) {
      this.router.navigateByUrl('/ingreso-anonimo');
      return;
    }

    // Si tiene datos, registrar directamente
    const loading = await this.loadingController.create({
      spinner: 'crescent',
      message: 'Registrando en lista de espera...',
      cssClass: 'spinner-verabri',
    });
    await loading.present();

    try {
      // Convertir dataUrl a File
      const response = await fetch(fotoUrl);
      const blob = await response.blob();
      const archivo = new File([blob], `anonimo-${Date.now()}.jpg`, { type: 'image/jpeg' });

      const urlFoto = await this.supabase.subirFoto(archivo, 'anonimos');
      const fcmToken = this.pushNotifications.getFCMToken();

      const { error } = await this.supabase.client
        .from('lista_espera')
        .insert({
          cliente_id: crypto.randomUUID(),
          nombre: nombre,
          foto_url: urlFoto,
          estado: 'esperando',
          fcm_token: fcmToken || null
        });

      if (error) throw error;

      // Limpiar sessionStorage
      sessionStorage.removeItem('anonimo_nombre');
      sessionStorage.removeItem('anonimo_foto_url');

      this.pushNotifications.enviarPushNotificationAUsuario('¡Nueva petición!', 'Un cliente ha solicitado una mesa.', 'metre@verabri.com');

      const toast = await this.toastController.create({
        message: '¡Estás en la lista de espera!',
        duration: 2500,
        position: 'top',
        color: 'success',
        icon: 'checkmark-circle-outline'
      });
      await toast.present();

    } catch (error: any) {
      console.error('Error:', error);
      const toast = await this.toastController.create({
        message: 'No se pudo registrar. Intentá de nuevo.',
        duration: 2500,
        position: 'top',
        color: 'danger',
        icon: 'alert-circle-outline'
      });
      await toast.present();
    } finally {
      await loading.dismiss();
    }
  }

  irAMenu() {
    this.router.navigateByUrl('/menu');
  }
}