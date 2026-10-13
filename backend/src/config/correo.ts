import nodemailer from 'nodemailer';

// El tipo del "transporter" es lo que devuelve createTransport
type Transporter = ReturnType<typeof nodemailer.createTransport>;

let transporter: Transporter | null = null;

// Si hay SMTP configurado en .env se usa ese; si no, una cuenta de prueba de Ethereal
async function obtenerTransporter(): Promise<Transporter> {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  } else {
    const cuenta = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: { user: cuenta.user, pass: cuenta.pass },
    });
    console.log('Usando correo de prueba (Ethereal)');
  }
  return transporter;
}

export async function enviarCorreo(para: string, asunto: string, html: string): Promise<void> {
  const t = await obtenerTransporter();
  const info = await t.sendMail({
    from: '"PetPass" <no-reply@petpass.app>',
    to: para,
    subject: asunto,
    html,
  });

  // Con Ethereal, muestra en la terminal el link para ver el correo
  const vistaPrevia = nodemailer.getTestMessageUrl(info);
  if (vistaPrevia) console.log(`Vista previa del correo: ${vistaPrevia}`);
}