import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { BienvenidaPublicaPage } from './bienvenida-publica.page';

const routes: Routes = [
  {
    path: '',
    component: BienvenidaPublicaPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BienvenidaPublicaPageRoutingModule {}
