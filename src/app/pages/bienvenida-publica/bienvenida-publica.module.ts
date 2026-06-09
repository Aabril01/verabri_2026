import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { BienvenidaPublicaPageRoutingModule } from './bienvenida-publica-routing.module';

import { BienvenidaPublicaPage } from './bienvenida-publica.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BienvenidaPublicaPageRoutingModule
  ],
  declarations: [BienvenidaPublicaPage]
})
export class BienvenidaPublicaPageModule {}
