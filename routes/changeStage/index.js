const express = require("express");
const router = express.Router();
const Sentry = require("@sentry/node");
const db = require("../../lib/db");
const cache = require("../../lib/cache");
const sendEmail = require("../../lib/sendEmail");
const { getStageNotificationUsers } = require("../../lib/notificationRoles");
const { createNotifications } = require("../../lib/notifications");
const { buildEmailHtml, highlightBox } = require("../../lib/emailTemplate");

router.post("/", async (req, res) => {
  if (!req.body) {
    console.log(req.body);
    res
      .status(400)
      .json({ msg: "Petición de login inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const formData = req.body;
  const etapaId = parseInt(formData.etapa_id);

  // Si etapa_id viene vacío/no-numérico, parseInt da NaN — sin este chequeo
  // se intentaba escribir NaN en la columna FK etapa_id (int) de
  // proyectos_stages, un valor sin sentido para esa columna.
  if (Number.isNaN(etapaId)) {
    console.warn(
      `[POST /changeStage] etapa_id inválido recibido: ${JSON.stringify(formData.etapa_id)} (proyecto ${formData.projectID})`,
    );
    return res.status(400).json({ msg: "La etapa indicada no es válida" });
  }

  const stageUpdate = await db
    .update(
      "proyectos_stages",
      {
        etapa_id: etapaId,
      },
      "proyecto_id = ?",
      [formData.projectID],
    )
    .catch((err) => {
      res.status(400).json({
        msg: `No se pudo actualizar la información genérica`,
        error: err,
      });
      throw new Error(`No se pudo actualizar la información genérica` + err);
    });

  cache.delete("allProjects");

  // El aviso por correo no debe tumbar la respuesta si Gmail falla: se
  // intenta, se registra el error si algo sale mal, y se responde igual.
  try {
    const [projectRows, etapaRows, recipients] = await Promise.all([
      db.select("proyectos_new", {
        values: "nombre",
        where: "id = ?",
        params: [formData.projectID],
      }),
      db.select("etapas", {
        values: "nombre",
        where: "id = ?",
        params: [etapaId],
      }),
      getStageNotificationUsers(etapaId),
    ]);

    const projectName = projectRows[0]?.nombre || `Proyecto #${formData.projectID}`;
    const etapaName = etapaRows[0]?.nombre || `Etapa #${etapaId}`;
    const emails = recipients.map((row) => row.correo_electronico).filter(Boolean);

    await Promise.all([
      sendEmail({
        to: emails,
        // Asunto concreto: dice el proyecto y la etapa nueva sin tener que
        // abrir el correo.
        subject: `${projectName} → ${etapaName}`,
        html: buildEmailHtml({
          heading: "Cambio de etapa",
          bodyHtml: `
            <p>El proyecto <b>${projectName}</b> avanzó de etapa.</p>
            ${highlightBox("Nueva etapa", etapaName)}
          `,
        }),
      }),
      createNotifications(
        recipients.map((row) => ({
          usuario_id: row.id,
          proyecto_id: formData.projectID,
          tipo: "cambio_etapa",
          titulo: `Cambio de etapa: ${projectName}`,
          mensaje: `El proyecto avanzó a la etapa "${etapaName}".`,
          remitente_usuario_id: formData.remitente_usuario_id ?? null,
        })),
      ),
    ]);
  } catch (error) {
    console.error("Error enviando notificación de cambio de etapa", error);
    Sentry.captureException(error, {
      extra: { proyectoId: formData.projectID, etapaId },
    });
  }

  return res.status(200).json(stageUpdate);
});

module.exports = router;
