import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { AltaEmpleadoPageRoutingModule } from './alta-empleado-routing.module';
import { ReactiveFormsModule } from '@angular/forms';
import { AltaEmpleadoPage } from './alta-empleado.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AltaEmpleadoPageRoutingModule,
    ReactiveFormsModule
  ],
  declarations: [AltaEmpleadoPage]
})
export class AltaEmpleadoPageModule {}
