import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from 'src/app/services/supabase';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  standalone: false,
  selector: 'app-estadistica',
  templateUrl: './estadistica.page.html',
  styleUrls: ['./estadistica.page.scss'],
})
export class EstadisticaPage implements OnInit {
  @ViewChild('barCanvas', { static: false }) barCanvas!: ElementRef;

  cargando = true;
  totalEncuestas = 0;
  valoracionGeneral = 0;
  porcentajeVolveria = 0;
  
  comentarios: string[] = [];
  topCanales: { canal: string, cantidad: number }[] = [];
  chartBar: any;

  constructor(
    private supabase: SupabaseService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  async ngOnInit() {
    const origen = this.route.snapshot.paramMap.get('origen');
    if (!origen) {
      await this.router.navigateByUrl('/home', { replaceUrl: true });
      return;
    }
    this.cargarEstadisticas();
  }

  async cargarEstadisticas() {
    this.cargando = true;
    try {
      const { data: encuestas, error } = await this.supabase.client
        .from('encuestas')
        .select('*');

      if (error) throw error;

      if (encuestas && encuestas.length > 0) {
        this.totalEncuestas = encuestas.length;

        const sumaCalificacion = encuestas.reduce((acc, curr) => acc + curr.calificacion, 0);
        this.valoracionGeneral = Number((sumaCalificacion / this.totalEncuestas).toFixed(1));

        const cuantosVolverian = encuestas.filter(e => e.volveria === true).length;
        this.porcentajeVolveria = Math.round((cuantosVolverian / this.totalEncuestas) * 100);

        this.comentarios = encuestas
          .map(e => e.comentario)
          .filter(c => c && c.trim() !== '')
          .slice(0, 5);

        let sumaComida = 0;
        let sumaServicio = 0;
        let sumaLimpieza = 0;
        let sumaAmbiente = 0;

        encuestas.forEach(e => {
          sumaComida += e.aspectos?.comida || 0;
          sumaServicio += e.aspectos?.servicio || 0;
          sumaLimpieza += e.aspectos?.limpieza || 0;
          sumaAmbiente += e.aspectos?.ambiente || 0;
        });

        const pComida = Number((sumaComida / this.totalEncuestas).toFixed(1));
        const pServicio = Number((sumaServicio / this.totalEncuestas).toFixed(1));
        const pLimpieza = Number((sumaLimpieza / this.totalEncuestas).toFixed(1));
        const pAmbiente = Number((sumaAmbiente / this.totalEncuestas).toFixed(1));

        this.cargando = false;

        setTimeout(() => {
          this.generarGrafico(pComida, pServicio, pLimpieza, pAmbiente);
        }, 50);

      } else {
        this.cargando = false;
      }

    } catch (error) {
      console.error('Error al procesar estadísticas:', error);
      this.cargando = false;
    }
  }

  generarGrafico(comida: number, servicio: number, limpieza: number, ambiente: number) {
    if (!this.barCanvas || !this.barCanvas.nativeElement) {
      setTimeout(() => this.generarGrafico(comida, servicio, limpieza, ambiente), 50);
      return;
    }

    if (this.chartBar) {
      this.chartBar.destroy(); 
    }

    this.chartBar = new Chart(this.barCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: ['Comida', 'Servicio', 'Limpieza', 'Ambiente'],
        datasets: [{
          label: 'Puntaje Promedio',
          data: [comida, servicio, limpieza, ambiente],
          backgroundColor: [
            'rgba(251, 188, 5, 0.7)',
            'rgba(54, 162, 235, 0.7)',
            'rgba(75, 192, 192, 0.7)',
            'rgba(153, 102, 255, 0.7)'
          ],
          borderColor: ['#fbbc05', '#36a2eb', '#4bc1c0', '#9966ff'],
          borderWidth: 1.5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 5,
            ticks: { stepSize: 1 }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }
}