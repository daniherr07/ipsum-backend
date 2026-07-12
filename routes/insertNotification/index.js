const express = require("express");
const router = express.Router();
const db = require("../../lib/db");
const sendEmail = require("../../lib/sendEmail");
const { buildEmailHtml, highlightBox } = require("../../lib/emailTemplate");

// Escapa el mensaje libre del usuario antes de meterlo en el HTML del
// correo — es texto arbitrario, no confiar en él para no arrastrar una
// inyección de HTML dentro del email.
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

router.post("/", async (req, res) => {
  if (!req.body) {
    res.status(400).json({ msg: "Petición inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const {
    proyecto_id,
    remitente_usuario_id,
    destinatario_usuario_id,
    asunto,
    mensaje,
  } = req.body;

  if (
    !proyecto_id ||
    !remitente_usuario_id ||
    !destinatario_usuario_id ||
    !asunto ||
    !mensaje
  ) {
    return res
      .status(400)
      .json({ msg: "Faltan datos para enviar la notificación" });
  }

  const [proyectoRows, remitenteRows, destinatarioRows] = await Promise.all([
    db.select("proyectos_new", {
      values: "nombre",
      where: "id = ?",
      params: [proyecto_id],
    }),
    db.select("usuarios", {
      values: "nombre, apellido1",
      where: "id = ?",
      params: [remitente_usuario_id],
    }),
    db.select("usuarios", {
      values: "nombre, apellido1, correo_electronico",
      where: "id = ? and activated = 1",
      params: [destinatario_usuario_id],
    }),
  ]).catch((err) => {
    res.status(400).json({ msg: "No se pudo enviar la notificación", error: err });
    throw new Error("No se pudo enviar la notificación", err);
  });

  if (!destinatarioRows || destinatarioRows.length === 0) {
    return res
      .status(400)
      .json({ msg: "El destinatario no existe o está inactivo" });
  }

  const proyectoNombre = proyectoRows[0]?.nombre || `Proyecto #${proyecto_id}`;
  const remitente = remitenteRows[0];
  const remitenteNombre = remitente
    ? `${remitente.nombre} ${remitente.apellido1 || ""}`.trim()
    : "Un usuario";
  const destinatario = destinatarioRows[0];

  const notificationInsert = await db
    .insert("notificaciones", {
      usuario_id: destinatario_usuario_id,
      proyecto_id,
      tipo: "manual",
      // El asunto que escribe quien envía es el título real (antes era
      // siempre "Mensaje de {remitente}", sin decir de qué se trataba).
      titulo: asunto,
      mensaje,
      remitente_usuario_id,
    })
    .catch((err) => {
      res.status(400).json({ msg: "No se pudo guardar la notificación", error: err });
      throw new Error("No se pudo guardar la notificación", err);
    });

  // El correo es best-effort, igual que en changeStage/new: si Gmail falla
  // no debe tumbar la respuesta, la notificación ya quedó guardada in-app.
  try {
    const safeAsunto = escapeHtml(asunto);
    const safeMessage = escapeHtml(mensaje).replace(/\n/g, "<br>");

    await sendEmail({
      to: destinatario.correo_electronico,
      subject: `${proyectoNombre}: ${asunto}`,
      html: buildEmailHtml({
        heading: "Notificación manual",
        bodyHtml: `
          ${highlightBox("Proyecto", proyectoNombre)}
          ${highlightBox("De", remitenteNombre)}
          ${highlightBox("Asunto", safeAsunto)}
          <p style="margin-top: 16px;">${safeMessage}</p>
        `,
      }),
    });
  } catch (error) {
    console.error("Error enviando correo de notificación manual", error);
  }

  return res.status(200).json(notificationInsert);
});

module.exports = router;
