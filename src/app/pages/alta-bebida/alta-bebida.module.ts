import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AltaBebidaPageRoutingModule } from './alta-bebida-routing.module';
import { AltaBebidaPage } from './alta-bebida.page';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    AltaBebidaPageRoutingModule
  ],
  declarations: [AltaBebidaPage]
})
export class AltaBebidaPageModule {}