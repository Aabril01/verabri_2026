import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'splash',
    pathMatch: 'full'
  },
  {
    path: 'splash',
    loadChildren: () => import('./pages/splash/splash.module').then(m => m.SplashPageModule)
  },
  {
    path: 'login',
    loadChildren: () => import('./pages/login/login.module').then(m => m.LoginPageModule)
  },
  {
    path: 'home',
    loadChildren: () => import('./home/home.module').then(m => m.HomePageModule)
  },
  {
    path: 'alta-empleado',
    loadChildren: () => import('./pages/alta-empleado/alta-empleado.module').then(m => m.AltaEmpleadoPageModule)
  },
  {
    path: 'alta-mesa',
    loadChildren: () => import('./pages/alta-mesa/alta-mesa.module').then(m => m.AltaMesaPageModule)
  },
  {
    path: 'alta-plato',
    loadChildren: () => import('./pages/alta-plato/alta-plato.module').then(m => m.AltaPlatoPageModule)
  },
  {
    path: 'alta-bebida',
    loadChildren: () => import('./pages/alta-bebida/alta-bebida.module').then(m => m.AltaBebidaPageModule)
  },
  {
    path: 'alta-cliente',
    loadChildren: () => import('./pages/alta-cliente/alta-cliente.module').then(m => m.AltaClientePageModule)
  },
  {
    path: 'pendiente-registros',
    loadChildren: () => import('./pages/pendiente-registros/pendiente-registros.module').then(m => m.PendienteRegistrosPageModule)
  },
  {
    path: 'ingreso-anonimo',
    loadChildren: () => import('./pages/ingreso-anonimo/ingreso-anonimo.module').then( m => m.IngresoAnonimoPageModule)
  },
  {
    path: 'lista-espera',
    loadChildren: () => import('./pages/lista-espera/lista-espera.module').then( m => m.ListaEsperaPageModule)
  },
  {
    path: 'ingreso-cliente',
    loadChildren: () => import('./pages/ingreso-cliente/ingreso-cliente.module').then( m => m.IngresoClientePageModule)
  },
  {
    path: 'menu',
    loadChildren: () => import('./pages/menu/menu.module').then( m => m.MenuPageModule)
  },
  {
    path: 'mesa/:id',
    loadChildren: () => import('./pages/mesa/mesa.module').then( m => m.MesaPageModule)
  },
  {
    path: 'chat/:mesaId',
    loadChildren: () => import('./pages/chat/chat.module').then( m => m.ChatPageModule)
  },
  {
    path: 'consultas-mozo',
    loadChildren: () => import('./pages/consultas-mozo/consultas-mozo.module').then( m => m.ConsultasMozoPageModule)
  },
  {
    path: 'pedido',
    loadChildren: () => import('./pages/pedido/pedido.module').then( m => m.PedidoPageModule)
  },

  {
    path: 'pedido/:mesaId',
    loadChildren: () => import('./pages/pedido/pedido.module').then(m => m.PedidoPageModule)
  },
  {
    path: 'pedidos-mozo',
    loadChildren: () => import('./pages/pedidos-mozo/pedidos-mozo.module').then( m => m.PedidosMozoPageModule)
  },

  {
    path: 'pedidos-mozo',
    loadChildren: () => import('./pages/pedidos-mozo/pedidos-mozo.module').then(m => m.PedidosMozoPageModule)
  },

];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }