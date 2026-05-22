import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { JuegoMemoriaPageRoutingModule } from './juego-memoria-routing.module';

import { JuegoMemoriaPage } from './juego-memoria.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    JuegoMemoriaPageRoutingModule
  ],
  declarations: [JuegoMemoriaPage]
})
export class JuegoMemoriaPageModule {}
