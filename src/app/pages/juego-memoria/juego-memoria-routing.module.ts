import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { JuegoMemoriaPage } from './juego-memoria.page';

const routes: Routes = [
  {
    path: '',
    component: JuegoMemoriaPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class JuegoMemoriaPageRoutingModule {}
