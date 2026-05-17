import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { IngresoClientePageRoutingModule } from './ingreso-cliente-routing.module';

import { IngresoClientePage } from './ingreso-cliente.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    IngresoClientePageRoutingModule
  ],
  declarations: [IngresoClientePage]
})
export class IngresoClientePageModule {}
