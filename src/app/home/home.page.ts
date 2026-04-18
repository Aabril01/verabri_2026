import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../services/supabase';

@Component({
  standalone: false,
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {

  constructor(
    private router: Router,
    private supabaseService: SupabaseService
  ) {}

  async cerrarSesion() {
    await this.supabaseService.cerrarSesion();
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}