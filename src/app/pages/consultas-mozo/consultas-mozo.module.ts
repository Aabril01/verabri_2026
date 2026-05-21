import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ConsultasMozoPageRoutingModule } from './consultas-mozo-routing.module';

import { ConsultasMozoPage } from './consultas-mozo.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ConsultasMozoPageRoutingModule
  ],
  declarations: [ConsultasMozoPage]
})
export class ConsultasMozoPageModule {}
