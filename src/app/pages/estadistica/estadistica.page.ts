import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
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
    private supabase: SupabaseService
  ) {}

  ngOnInit() {
    this.cargarEstadisticas();
  }

  async cargarEstadisticas() {
    this.cargando = true;
    try {
      const { data: encuestas, error } = await this.supabase.client
        .from('encuestas')
        .select('*');

      if (error) throw error;

      //Si hay encuestas
      if (encuestas && encuestas.length > 0) {
        this.totalEncuestas = encuestas.length;

        //Promedio de Valoración General
        const sumaCalificacion = encuestas.reduce((acc, curr) => acc + curr.calificacion, 0);
        this.valoracionGeneral = Number((sumaCalificacion / this.totalEncuestas).toFixed(1));

        //Porcentaje de usuarios que volverían
        const cuantosVolverian = encuestas.filter(e => e.volveria === true).length;
        this.porcentajeVolveria = Math.round((cuantosVolverian / this.totalEncuestas) * 100);

        //Mapeo de comentarios recientes (filtrando nulos o vacíos)
        this.comentarios = encuestas
          .map(e => e.comentario)
          .filter(c => c && c.trim() !== '')
          .slice(0, 5); // últimos 5 registros

        //Acumuladores para el objeto JSONB de aspectos
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

        //Promedio
        const pComida = Number((sumaComida / this.totalEncuestas).toFixed(1));
        const pServicio = Number((sumaServicio / this.totalEncuestas).toFixed(1));
        const pLimpieza = Number((sumaLimpieza / this.totalEncuestas).toFixed(1));
        const pAmbiente = Number((sumaAmbiente / this.totalEncuestas).toFixed(1));

        this.cargando = false;

        //Paso datos a la barra
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

    //Por si ya hay barras creadas
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
            'rgba(251, 188, 5, 0.7)',  // Dorado para Comida
            'rgba(54, 162, 235, 0.7)', // Azul para Servicio
            'rgba(75, 192, 192, 0.7)', // Verde para Limpieza
            'rgba(153, 102, 255, 0.7)' // Violeta para Ambiente
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
