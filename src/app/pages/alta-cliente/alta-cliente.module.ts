import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { AltaClientePageRoutingModule } from './alta-cliente-routing.module';
import { ReactiveFormsModule } from '@angular/forms';
import { AltaClientePage } from './alta-cliente.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AltaClientePageRoutingModule,
    ReactiveFormsModule
  ],
  declarations: [AltaClientePage]
})
export class AltaClientePageModule {}
