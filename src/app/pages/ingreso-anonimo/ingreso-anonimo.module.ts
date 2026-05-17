import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { IngresoAnonimoPageRoutingModule } from './ingreso-anonimo-routing.module';

import { IngresoAnonimoPage } from './ingreso-anonimo.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    IngresoAnonimoPageRoutingModule
  ],
  declarations: [IngresoAnonimoPage]
})
export class IngresoAnonimoPageModule {}
