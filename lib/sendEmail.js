const nodemailer = require("nodemailer");

// Transporter único reutilizado en toda la app (antes /forgotPassword creaba
// el suyo propio); nodemailer maneja su propio pool de conexiones SMTP.
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Mientras esta constante tenga un valor, todos los correos salen hacia acá
// en vez de a los destinatarios reales (útil para probar el flujo de
// notificaciones sin mandarle correos de verdad a Felipe/Max/Magda/etc.).
// Para volver a los destinatarios reales, poner esta constante en null.
const TEST_EMAIL_OVERRIDE = "dherrera2195@gmail.com";

// to puede ser un string o un arreglo de correos; nodemailer los une solo.
// Si queda vacío (nadie que notificar), no intenta enviar nada.
async function sendEmail({ to, subject, html }) {
  if (!to || (Array.isArray(to) && to.length === 0)) return null;

  const recipient = TEST_EMAIL_OVERRIDE || to;

  return transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: recipient,
    subject: TEST_EMAIL_OVERRIDE ? `[PRUEBA → ${to}] ${subject}` : subject,
    html,
  });
}

module.exports = sendEmail;
