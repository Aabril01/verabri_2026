import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { PendienteRegistrosPageRoutingModule } from './pendiente-registros-routing.module';

import { PendienteRegistrosPage } from './pendiente-registros.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PendienteRegistrosPageRoutingModule
  ],
  declarations: [PendienteRegistrosPage]
})
export class PendienteRegistrosPageModule {}
