import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IngresoAnonimoPage } from './ingreso-anonimo.page';

describe('IngresoAnonimoPage', () => {
  let component: IngresoAnonimoPage;
  let fixture: ComponentFixture<IngresoAnonimoPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(IngresoAnonimoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
