const express = require("express");
const router = express.Router();
const Sentry = require("@sentry/node");
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
  console.log(
    `[POST /insertNotification] enviando notificación manual (proyecto ${proyecto_id}, de ${remitente_usuario_id} a ${destinatario_usuario_id}, mensaje ${mensaje?.length ?? 0} caracteres)`,
  );

  if (
    !proyecto_id ||
    !remitente_usuario_id ||
    !destinatario_usuario_id ||
    !asunto ||
    !mensaje
  ) {
    console.warn(
      "[POST /insertNotification] faltan datos requeridos en la petición",
    );
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
    console.error(
      `[POST /insertNotification] no se pudo obtener datos de proyecto/remitente/destinatario (proyecto ${proyecto_id})`,
      err,
    );
    res.status(400).json({ msg: "No se pudo enviar la notificación", error: err });
    throw new Error("No se pudo enviar la notificación", err);
  });

  if (!destinatarioRows || destinatarioRows.length === 0) {
    console.warn(
      `[POST /insertNotification] destinatario ${destinatario_usuario_id} no existe o está inactivo`,
    );
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
      console.error(
        `[POST /insertNotification] no se pudo guardar la notificación (proyecto ${proyecto_id}, destinatario ${destinatario_usuario_id})`,
        err,
      );
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
    Sentry.captureException(error, {
      extra: { proyectoId: proyecto_id, destinatarioUsuarioId: destinatario_usuario_id },
    });
  }

  console.log(
    `[POST /insertNotification] notificación manual enviada correctamente (proyecto ${proyecto_id}, destinatario ${destinatario_usuario_id})`,
  );

  return res.status(200).json(notificationInsert);
});

module.exports = router;
