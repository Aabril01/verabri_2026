import { inject, Injectable, NgZone} from '@angular/core';
import { PushNotifications, PushNotificationSchema, RegistrationError, Token, ActionPerformed } from '@capacitor/push-notifications';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase';
import { Capacitor } from '@capacitor/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ToastController } from '@ionic/angular';


@Injectable({
  providedIn: 'root',
})
export class PushNotification {
  private supabase = inject(SupabaseService);

  private _fcmtoken = new BehaviorSubject<string | null>(null);
  fcmtoken$: Observable<string | null> = this._fcmtoken.asObservable();

  // Guarda el último token recibido para usarse posteriormente (ej. al iniciar sesión)
  private ultimoFCMToken: string | null = null;

  constructor(
    private ngZone: NgZone,
    private toastController: ToastController
  ){}

  async inicirPushNotifications (usuarioInicial: User | null = null){
    //Si está en android, pedirá permisos para mandar notificaciones
    if(Capacitor.isNativePlatform()){
      let permStatus = await PushNotifications.requestPermissions();

      if(permStatus.receive === 'prompt' || permStatus.receive === 'denied'){
        console.warn('Service/Push: Permisos de notificaciones no otorgados.');
        this.mostrarToast("No te llegarán notificaciones.", "warning");
        return;
      }
        
      PushNotifications.addListener('registration', async (token: Token) => {
        this.ngZone.run(async () =>{
          this._fcmtoken.next(token.value);
          this.ultimoFCMToken = token.value; //guardamos el token recibido.

          await this.guardarTokenEnSupabase(token.value, usuarioInicial);
        });
      });

      PushNotifications.addListener('registrationError', (error: RegistrationError) =>{
        console.error("Services/Push: Error en el registro push: ", error);
      });

      PushNotifications.addListener('pushNotificationReceived', (notificacion: PushNotificationSchema)=> {
        this.ngZone.run(async() => {
          console.log("DEBUG_APP: pushNotificationReceived listener ACTIVADO.");
        });
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (notificacion: ActionPerformed)=>{
        this.ngZone.run(() => {
          console.log("Services/Push: Push action performed: ", notificacion.actionId, notificacion.inputValue, notificacion.notification);
          //ESTA ES LA ACCIÓN CUANDO EL USUARIO TOCA LA NOTIFICACIÓN DESDE LA BANDEJA DEL SISTEMA.
        });
      });

      await PushNotifications.register();
      console.log("Services/Push: dispositivo registrado para envio de notificaciones.")

    } else {
      console.log("Services/Push: Push Notifications no se activará en la plataforma web.");
    }
  }

  // ── GUARDADO DE TOKENS ──────────────────────────────────

  /**
   * Almacena el token del usuario en Supabase.
   * @param token token del usuario
   * @param usuarioActual datos del usuario
   */
  private async guardarTokenEnSupabase(token: string, usuarioActual: User | null){
    const userUuid = usuarioActual?.id || null;
    const userEmail = usuarioActual?.email || null;

    try {
      const { data, error } = await this.supabase.client
        .from('fcm_tokens')
        .upsert(
          {
            token: token,
            uuid: userUuid,
            email_usuario: userEmail,
          },
          { onConflict: 'token'}
        );
      
      //Corroboramos resultado
      if(error){
        console.error("Services/Push: Error al guardar el token en Supabase: ", error.message);
      } else {
        console.log("Services/Push: Token de usuario guardado/actualizado en Supabase");
      }
    } catch (e:any){
      console.error('Services/Push: Excepción al enviar token a Supabase: ', e.message || e);
    }
  }

  getFCMToken(): string | null {
    return this._fcmtoken.getValue();
  }

  // ── RENOVACIÓN DE USUARIOS ──────────────────────────────────

  async actualizarTokenConNuevoUsuario(user: User | null){
    if(this.ultimoFCMToken){
      await this.guardarTokenEnSupabase(this.ultimoFCMToken, user);
    } else {
      console.warn("Services/Push: No hay tokens FCM para actualizar.")
    }
  }

   // ── TOAST ──────────────────────────────────

   private async mostrarToast(mensaje: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 2500,
      position: 'top',
      color,
      icon: color === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline'
    });
    await toast.present();
  }

  // ── MÉTODOS UTILIZABLES ──────────────────────────────────

  /**
   * Envía notificaciones al usuario con el email correspondiente.
   * @param title titulo de la notificación
   * @param body mensaje
   * @param email correo del usuario receptor
   * @param additionalData adicional (ej:url imagen)
   */
  async enviarPushNotificationAUsuario(
    title: string,
    body: string,
    email:string,
    additionalData: {[key:string]: any} ={}
  ):Promise<any>{
    try{
      let hacerPush = true;

      //buscamos tokens que correspondan al email, por si hay muliples dispositivos.
      const {data: tokensData, error: tokenError} = await this.supabase.client
      .from('fcm_tokens')
      .select('token')
      .in('email_usuario', [email]);

      if(tokenError) {
        console.error("Error al obtener tokens: ", tokenError);
        return {success: false, error:tokenError.message}
      }

      if(!tokensData || tokensData.length === 0){
        console.warn("No hay tokens registrados.");
        hacerPush = false;
      }

      //Se enviarán la notificacion a esta lista de tokens
      const tokens = tokensData.map((t:any) => t.token);
      console.log("Tokens: ",tokens);
      
      if(hacerPush){
        const {data, error} = await this.supabase.client.functions.invoke('send-push-notifications', {
          body: {
            title: title,
            body: body,
            token: tokens,
            data: additionalData
          },
        });

        if(error){
          console.error("Services/Push: Error al invocar la Edge Functions: ", error.message);
          return {success: false, error: error.message}
        }

        if(data.success){
          console.log("Services/Push: Notificación enviada :)");
        } else {
          console.warn("Services/Push: la Edge Functions no pudo enviar notificacion")
        }
        return {success: data.success, results: data.results}
      }

    } catch (e:any){
      console.error("Excepción al llamar Edge Function send-push-notifications: ", e);
      return {succes: false, error: e.message || "Services/Push: Error desconocido"}
    }
  }

}
