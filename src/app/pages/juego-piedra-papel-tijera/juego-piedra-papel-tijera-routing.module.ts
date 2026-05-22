import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { JuegoPiedraPapelTijeraPage } from './juego-piedra-papel-tijera.page';

const routes: Routes = [
  {
    path: '',
    component: JuegoPiedraPapelTijeraPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class JuegoPiedraPapelTijeraPageRoutingModule {}
