import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AltaPlatoPageRoutingModule } from './alta-plato-routing.module';
import { AltaPlatoPage } from './alta-plato.page';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    AltaPlatoPageRoutingModule
  ],
  declarations: [AltaPlatoPage]
})
export class AltaPlatoPageModule {}