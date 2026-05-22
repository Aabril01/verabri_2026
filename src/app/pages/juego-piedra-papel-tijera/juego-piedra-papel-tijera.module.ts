import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { JuegoPiedraPapelTijeraPageRoutingModule } from './juego-piedra-papel-tijera-routing.module';

import { JuegoPiedraPapelTijeraPage } from './juego-piedra-papel-tijera.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    JuegoPiedraPapelTijeraPageRoutingModule
  ],
  declarations: [JuegoPiedraPapelTijeraPage]
})
export class JuegoPiedraPapelTijeraPageModule {}
