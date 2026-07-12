const express = require("express");
const router = express.Router();
const db = require("../../lib/db");
const bcrypt = require("bcrypt");
const generatePassword = require("generate-password");
const sendEmail = require("../../lib/sendEmail");
const { buildEmailHtml, highlightBox } = require("../../lib/emailTemplate");
const rateLimit = require("../../lib/rateLimit");

const saltRounds = 10;

// 5 solicitudes cada 15 minutos por IP: cada una manda un correo real y
// genera/hashea una contraseña nueva, no se quiere que sea gratis de spamear.
const forgotPasswordRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyPrefix: "forgotPassword",
});

router.post("/", forgotPasswordRateLimit, async (req, res) => {
  if (!req.body) {
    res.status(400).json({ msg: "Petición inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ msg: "Debe indicar un correo o usuario" });
  }

  const userSelect = await db
    .select("usuarios", {
      values: "id, correo_electronico",
      where: "correo_electronico = ? or nombre = ?",
      params: [email, email],
    })
    .catch((err) => {
      res.status(400).json({ msg: "No se pudo buscar el usuario", error: err });
      throw new Error("No se pudo buscar el usuario", err);
    });

  if (!userSelect || userSelect.length === 0) {
    // 200 (no 400): no revela si el correo/usuario existe o no en el
    // sistema; el frontend distingue este caso vía el campo noUser.
    return res.status(200).json({ noUser: true });
  }

  const user = userSelect[0];

  // Contraseña temporal que el usuario deberá cambiar tras iniciar sesión.
  const newPassword = generatePassword.generate({
    length: 10,
    numbers: true,
  });

  try {
    await sendEmail({
      to: user.correo_electronico,
      // Asunto concreto: dice qué recibió el usuario y de dónde, no solo
      // "Recuperación de contraseña" genérico.
      subject: "Tu contraseña temporal de Ipsum",
      html: buildEmailHtml({
        heading: "Recuperación de contraseña",
        bodyHtml: `
          <p>Recibimos una solicitud para restablecer tu contraseña.</p>
          ${highlightBox("Contraseña temporal", newPassword)}
          <p>Por seguridad, inicia sesión y cámbiala lo antes posible.</p>
        `,
      }),
    });
  } catch (error) {
    console.error("Error enviando correo de recuperación de contraseña", error);
    return res.status(500).json({ msg: "No se pudo enviar el correo" });
  }

  // El correo ya se envió con la contraseña en texto plano; recién acá se
  // guarda hasheada, para no dejar a un usuario con una contraseña que
  // nunca le llegó si el hash fallara antes del envío.
  const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

  await db
    .update(
      "usuarios",
      { password: hashedPassword, estado: 0 },
      "id = ?",
      [user.id],
    )
    .catch((err) => {
      res.status(400).json({
        msg: "No se pudo actualizar la contraseña",
        error: err,
      });
      throw new Error("No se pudo actualizar la contraseña", err);
    });

  return res.status(200).json({ ok: true });
});

module.exports = router;
