import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ConsultasMozoPage } from './consultas-mozo.page';

const routes: Routes = [
  {
    path: '',
    component: ConsultasMozoPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ConsultasMozoPageRoutingModule {}
