import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, nombre, estado } = await req.json();

    const esAceptado = estado === 'aceptado';

    const asunto = esAceptado
      ? '¡Bienvenido a Verabri! Tu cuenta fue aprobada'
      : 'Verabri — Estado de tu registro';

    const mensaje = esAceptado
      ? `¡Felicitaciones! Tu solicitud de registro fue <strong style="color:#2A8C50;">aprobada</strong>. Ya podés ingresar a la aplicación con tu correo y contraseña.`
      : `Lamentablemente, tu solicitud de registro fue <strong style="color:#C0392B;">rechazada</strong>. Si creés que esto es un error, comunicate con el restaurante.`;

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${asunto}</title>
      </head>
      <body style="margin:0; padding:0; background-color:#F0E6D3; font-family: Georgia, serif;">

        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F0E6D3; padding: 40px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color:#6B4E7A; border-radius:16px; overflow:hidden;">

                <!-- HEADER -->
                <tr>
                  <td style="background-color:#C9943A; padding: 28px 40px; text-align:center;">
                    <h1 style="margin:0; font-family: Georgia, serif; font-size: 32px; color:#F5EEF0; letter-spacing: 3px;">
                      VERABRI
                    </h1>
                    <p style="margin:6px 0 0; font-size:13px; color:#F5EEF0; letter-spacing:1px; font-style:italic;">
                      Parrilla &amp; Restaurante
                    </p>
                  </td>
                </tr>

                <!-- BODY -->
                <tr>
                  <td style="padding: 40px;">

                    <h2 style="font-family: Georgia, serif; font-size: 22px; color:#C9943A; margin: 0 0 16px;">
                      Hola, ${nombre}
                    </h2>

                    <p style="font-size: 16px; color:#F0E6D3; line-height: 1.7; margin: 0 0 24px;">
                      ${mensaje}
                    </p>

                    <hr style="border: none; border-top: 1px solid rgba(240,230,211,0.25); margin: 24px 0;">

                    <p style="font-size: 13px; color:rgba(240,230,211,0.6); text-align:center; margin:0; font-style:italic;">
                      Este correo fue enviado automáticamente por el sistema de Verabri.<br>
                      Por favor, no respondas este mensaje.
                    </p>

                  </td>
                </tr>

                <!-- FOOTER -->
                <tr>
                  <td style="background-color:#C9943A; padding: 16px 40px; text-align:center;">
                    <p style="margin:0; font-size:12px; color:#F5EEF0; letter-spacing:0.5px;">
                      © 2026 Verabri — UTN Avellaneda
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>

      </body>
      </html>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Verabri <onboarding@resend.dev>',
        to: [email],
        subject: asunto,
        html,
      }),
    });

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});