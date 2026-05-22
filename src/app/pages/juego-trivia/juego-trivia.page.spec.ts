import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JuegoTriviaPage } from './juego-trivia.page';

describe('JuegoTriviaPage', () => {
  let component: JuegoTriviaPage;
  let fixture: ComponentFixture<JuegoTriviaPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(JuegoTriviaPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
