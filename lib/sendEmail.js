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

// Antes esto forzaba TODOS los correos hacia una sola dirección de prueba
// (para probar el flujo de notificaciones sin mandarle correos de verdad a
// Felipe/Max/Magda/etc.). Ya se puede dejar en null para que cada correo
// vaya a su destinatario real.
const TEST_EMAIL_OVERRIDE = null;

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
