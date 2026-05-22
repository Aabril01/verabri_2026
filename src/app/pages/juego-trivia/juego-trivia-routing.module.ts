import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { JuegoTriviaPage } from './juego-trivia.page';

const routes: Routes = [
  {
    path: '',
    component: JuegoTriviaPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class JuegoTriviaPageRoutingModule {}
