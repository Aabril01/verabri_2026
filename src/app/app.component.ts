import { Component } from '@angular/core';
import { PushNotification } from './services/push-notifications';
import { NativeAudio } from '@capacitor-community/native-audio';
import { App } from '@capacitor/app';

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
    this.escucharCierreApp();
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

  escucharCierreApp() {
    App.addListener('backButton', async ({ canGoBack }) => {
      if (!canGoBack) {
        try {
          await NativeAudio.play({ assetId: 'cierre' });
        } catch (e) {}
        setTimeout(() => App.exitApp(), 500);
      }
    });
  }
}