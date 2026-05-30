import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// import { create, getNumericDate, Header, Payload } from "https://deno.land/x/djwt@v2.4/mod.ts"; // COMENTAR O ELIMINAR ESTA LÍNEA
import * as jose from 'https://deno.land/x/jose@v6.1.0/index.ts'

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID")!;
//const FIREBASE_PRIVATE_KEY = Deno.env.get("FIREBASE_PRIVATE_KEY")!;
const FIREBASE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC5KU+FID6kPwxt\na0R9WyAxXKeJQ3svmIxX9mOza1cI0hmmEDA++dkNGx0NNkp+Vgpkl8WaI4YuyCs1\nOobo1aGu8CjeGd50AazUljwG6dNnRmkbuAxSwmYf4mSKROJojc0DtlWcnxR44LrC\nEw+Kfc0ZMuQAQX4lFDKSKJYW/ajgAWEFpVLpI8MzG8j42r6VIcSQAJEiEDM05161\nRhf8pn2clUdl+Az79iwkgfW0i2/V2b30TOfEhacBlnIGQi9QuzyAkD8H+AhvnWFA\nt7nAuUC4vd24mG0hlGOex7OA0q+BxAkjEDBMakfxu7d1KEhXHbMd5GOtHOm55Ozl\nxXZ23c2pAgMBAAECggEAJdm5BLi7tW2iB7gWzx1SrmSHZvrhcrBXeB/I78NwjkAM\nuDK0+hqu8Qvq22mOvtat1zRjU4gRhPysQHxPWcdZ/t3fLM/S9pnlD6wKZ0tjSMhO\n8jikZEKTB8+Kx+0e70qVbz3VsGegkrk11Dh7Q89FnvIVQ6wfskq3r8MWM2r1G50z\nca1qtMMLYXta9oKa08+M2WJkKW1LrNm7CJBkFj4ml+L8aok6owEi4uHJcy9jprkX\nynTmCDbMbB/0byD13n1PQIqrQ5/aB47Wg0DHsDU2YtAUAGt0U5+AeygYdjoYOfMu\n7KSmzKczO1WAbWkUuFFgj5pSzhBAMy3XBKRPo2G0ZQKBgQDj+9WBhhtPES3afJE2\n1Re0a2rh8ZCLgY7y2613XH2He1LrbegnNfjvwjQY1KBSPd9obvAHp7tNON+GGWAo\nlB7JAQ+/YDDocPmqKvGW+x6zG+kpOpnSdo/ADudjNH02U6HOAQxVcIkitKbr/7ET\n2dcQFiLAsIxXEu2ZotGW7O4HxwKBgQDP6lK+aI9qgsIu4nNt6Dymgs4tsWDjVhFb\nqMPldl1XeB3WLbnsiI8Tc+P0qmXasRd3EL98g/Y7Owj2wiXwWhBZx8+c1C8yp/b4\nfhoofFLToGoZ0P6IV1z+7XDXKV+SvzMWWhGzR2Klz6tqHtrkloktA9df6E7yx7e/\nI+7N1LPfDwKBgHje+bF0ImJnH0JpLKw/ihPTp5Um95WfGOTVZ0CTPtJnpezAFodD\nbDnhYrGPeXhg6WN6/bNxUDJ+5rM4HO0mqrOy5mB2ZTe3PgbkQbXkacBYGeQL96XH\nyirvO+oy1/fHm0+W6q0ZvvsxgBY7N+zoX8ddlQtIDv/TPzlnQ2ubLg/dAoGAaLLM\n3Al3PuF9u3JZQh1SfV8dSDEsYw5ySz/e9ev28RcRn0sDdzMFKXyQbCJqjAflkxWh\n96fUFNuTlf8Kb9BKr4tI5uaKpe2jFlsZ/Q0uAFelVj7CDhJASDd1PUQeVp1lsnnE\ntAzchjbfUN8cx0Nu7HYkvK0VJHih9OS5Wnkj4s0CgYEAwB16UHu5uTSgDl+C2/2h\n2dhQ5v4lNUvUkUW939q7h1/2lC8ckpt66cmBTYodHjOcGGKh2AVSUeJVaxn6ujMQ\ndlbbX/uzT99IAi9MIPGEfUNJXqMWxQXTTj2aT4NF6jS5gyG90egfMwehq0oKYt47\n97SjPWLZehF5z6CbrtDi5oM=\n-----END PRIVATE KEY-----\n"
const FIREBASE_CLIENT_EMAIL = Deno.env.get("FIREBASE_CLIENT_EMAIL")!;

console.log("DEBUG: Valor de FIREBASE_PRIVATE_KEY (primeros 50 chars):", FIREBASE_PRIVATE_KEY ? FIREBASE_PRIVATE_KEY.substring(0, 50) + "..." : "UNDEFINED/EMPTY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Función para generar el Access Token JWT para Firebase
async function getFirebaseAccessToken(): Promise<string> {
  console.log("DEBUG: Iniciando getFirebaseAccessToken con jose.");
  console.log("DEBUG: Valor de FIREBASE_PRIVATE_KEY (primeros 50 chars):", FIREBASE_PRIVATE_KEY.substring(0, 50) + "...");
  console.log("DEBUG: Tipo de FIREBASE_PRIVATE_KEY:", typeof FIREBASE_PRIVATE_KEY);
  console.log("DEBUG: FIREBASE_CLIENT_EMAIL:", FIREBASE_CLIENT_EMAIL);


  const privateKeyPem = FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

  try {
    // 1. Importar la clave privada PEM
    // jose.importJWK requiere que la clave sea en formato JWK.
    // Para PEM, usamos jose.importPKCS8 (para claves privadas) o jose.importSPKI (para claves públicas)
    // El tipo de clave de Firebase es PKCS#8 para la clave privada.
    const privateKey = await jose.importPKCS8(privateKeyPem, "RS256");

    // 2. Crear el JWT
    const jwt = await new jose.SignJWT({
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime("1h") // Expira en 1 hora
      .setAudience("https://oauth2.googleapis.com/token")
      .setIssuer(FIREBASE_CLIENT_EMAIL)
      .sign(privateKey);

    // 3. Solicitar el token de acceso a Google
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", // ¡Asegúrate que no sea oauth:oauth!
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Error al obtener el token de acceso de Firebase: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log("DEBUG: Token de acceso de Firebase obtenido con éxito.");
    return data.access_token;
  } catch (e: any) {
    console.error("DEBUG: Error en getFirebaseAccessToken (jose):", e.message, e);
    throw e; // Re-lanzar el error para que sea capturado por el catch principal
  }
}

serve(async (req) => {
  console.log("DEBUG: Edge Function 'send-push-notifications' INICIADA.");

  // Configuración de CORS
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Agregamos 'token' y 'tokens' a la destructuración para capturar lo que envía tu servicio
    const { title, body, userId, token, tokens: explicitTokens, data } = await req.json();

    if (!title || !body) {
      return new Response(JSON.stringify({ error: "Title and body are required." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    let tokensToSend: string[] = [];

    // 2. ORDEN DE PRIORIDAD PARA EVALUAR QUÉ TOKENS USAR:
    
    if (explicitTokens && Array.isArray(explicitTokens) && explicitTokens.length > 0) {
      // Prioridad 1: Si mandás un array de strings directo ('tokens') desde tu servicio estructurado
      tokensToSend = explicitTokens;
    } else if (token) {
      // Prioridad 2: Si mandás un único token como string o array bajo la clave 'token'
      tokensToSend = Array.isArray(token) ? token : [token];
    } else if (userId) {
      // Prioridad 3: Si mandás un userId, los va a buscar a la base de datos
      const { data: userTokens, error: tokensError } = await supabase
        .from("fcm_tokens")
        .select("token")
        .eq("uuid", userId);

      if (tokensError) throw tokensError;
      tokensToSend = userTokens.map((t) => t.token);
    } else {
      // ⚠️ Alerta / Broadcast Global: Solo si explícitamente no mandaste nada de lo anterior,
      // podés elegir si buscar todos o frenar la ejecución para evitar spam indeseado.
      console.warn("DEBUG: No se especificaron destinatarios. Buscando todos los tokens activos.");
      const { data: allTokens, error: tokensError } = await supabase
        .from("fcm_tokens")
        .select("token");
      
      if (tokensError) throw tokensError;
      tokensToSend = allTokens.map((t) => t.token);
    }

    // Remover posibles duplicados o strings vacíos indeseados
    tokensToSend = [...new Set(tokensToSend)].filter(t => !!t);

    if (tokensToSend.length === 0) {
      return new Response(JSON.stringify({ success: false, message: "No se encontraron tokens válidos para enviar." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.log(`DEBUG: Enviando notificaciones a ${tokensToSend.length} dispositivos.`);

    const firebaseAccessToken = await getFirebaseAccessToken();

    // 3. Mapeo y envío individual a Firebase v1 HTTP
    const results = await Promise.all(tokensToSend.map(async (fcmToken) => {
        const fcmPayload = {
            message: {
                token: fcmToken,
                notification: {
                    title: title,
                    body: body,
                },
                data: {
                  ...data,
                  source: "supabase_edge_function",
                  timestamp: new Date().toISOString(),
                }
            },
        };

        const fcmResponse = await fetch(`https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${firebaseAccessToken}`,
            },
            body: JSON.stringify(fcmPayload),
        });

        if (!fcmResponse.ok) {
            const errorText = await fcmResponse.text();
            console.error(`Error de FCM para token ${fcmToken}: ${errorText}`);
            return { token: fcmToken, success: false, error: errorText };
        }

        return { token: fcmToken, success: true, result: await fcmResponse.json() };
    }));

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Fallo crítico en Edge Function:", error.message);

    return new Response(JSON.stringify({ 
      error: error.message || "Internal server error",
      details: "Revisa los logs de Supabase para más info" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});