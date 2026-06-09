import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BienvenidaPublicaPage } from './bienvenida-publica.page';

describe('BienvenidaPublicaPage', () => {
  let component: BienvenidaPublicaPage;
  let fixture: ComponentFixture<BienvenidaPublicaPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(BienvenidaPublicaPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
