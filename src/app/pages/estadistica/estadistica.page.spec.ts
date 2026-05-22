import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EstadisticaPage } from './estadistica.page';

describe('EstadisticaPage', () => {
  let component: EstadisticaPage;
  let fixture: ComponentFixture<EstadisticaPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(EstadisticaPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
