import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JuegoPiedraPapelTijeraPage } from './juego-piedra-papel-tijera.page';

describe('JuegoPiedraPapelTijeraPage', () => {
  let component: JuegoPiedraPapelTijeraPage;
  let fixture: ComponentFixture<JuegoPiedraPapelTijeraPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(JuegoPiedraPapelTijeraPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
