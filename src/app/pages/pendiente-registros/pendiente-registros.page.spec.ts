import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PendienteRegistrosPage } from './pendiente-registros.page';

describe('PendienteRegistrosPage', () => {
  let component: PendienteRegistrosPage;
  let fixture: ComponentFixture<PendienteRegistrosPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PendienteRegistrosPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
