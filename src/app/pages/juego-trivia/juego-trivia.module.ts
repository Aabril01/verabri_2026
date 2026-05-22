import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { JuegoTriviaPageRoutingModule } from './juego-trivia-routing.module';

import { JuegoTriviaPage } from './juego-trivia.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    JuegoTriviaPageRoutingModule
  ],
  declarations: [JuegoTriviaPage]
})
export class JuegoTriviaPageModule {}
