import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { IngresoAnonimoPage } from './ingreso-anonimo.page';

const routes: Routes = [
  {
    path: '',
    component: IngresoAnonimoPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class IngresoAnonimoPageRoutingModule {}
