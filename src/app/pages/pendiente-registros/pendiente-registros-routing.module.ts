import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { PendienteRegistrosPage } from './pendiente-registros.page';

const routes: Routes = [
  {
    path: '',
    component: PendienteRegistrosPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PendienteRegistrosPageRoutingModule {}
