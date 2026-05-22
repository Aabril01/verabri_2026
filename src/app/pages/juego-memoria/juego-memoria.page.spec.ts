import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JuegoMemoriaPage } from './juego-memoria.page';

describe('JuegoMemoriaPage', () => {
  let component: JuegoMemoriaPage;
  let fixture: ComponentFixture<JuegoMemoriaPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(JuegoMemoriaPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
