import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IngresoClientePage } from './ingreso-cliente.page';

describe('IngresoClientePage', () => {
  let component: IngresoClientePage;
  let fixture: ComponentFixture<IngresoClientePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(IngresoClientePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
