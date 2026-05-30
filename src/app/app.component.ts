import { Component } from '@angular/core';
import { PushNotification } from './services/push-notifications';
import { NativeAudio } from '@capacitor-community/native-audio';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor(private pushService: PushNotification) {
    this.iniciarAudio();
    this.pushService.inicirPushNotifications();
  }

  async iniciarAudio() {
    await NativeAudio.preload({
      assetId: 'inicio',
      assetPath: 'public/assets/sounds/inicio.mp3',
      audioChannelNum: 1,
      isUrl: false
    });
    await NativeAudio.preload({
      assetId: 'cierre',
      assetPath: 'public/assets/sounds/cierre.mp3',
      audioChannelNum: 1,
      isUrl: false
    });
    await NativeAudio.play({ assetId: 'inicio' });
  }
}