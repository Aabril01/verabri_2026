import { Component } from '@angular/core';
import { PushNotification } from './services/push-notifications';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor(private pushService: PushNotification) {
    this.pushService.inicirPushNotifications();
  }
}