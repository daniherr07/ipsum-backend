const express = require("express");
const router = express.Router();
const db = require("../../lib/db");

router.post("/", async (req, res) => {
  if (!req.body) {
    res.status(400).json({ msg: "Petición inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const { id, usuario_id } = req.body;
  console.log(
    `[POST /markNotificationRead] marcando notificación ${id} como leída (usuario ${usuario_id})`,
  );

  if (!id || !usuario_id) {
    console.warn("[POST /markNotificationRead] faltan id/usuario_id en la petición");
    return res.status(400).json({ msg: "Faltan datos" });
  }

  // Filtra también por usuario_id (no solo id) para que un usuario no pueda
  // marcar como leída una notificación que no es suya.
  const result = await db
    .update("notificaciones", { leido: 1 }, "id = ? and usuario_id = ?", [
      id,
      usuario_id,
    ])
    .catch((err) => {
      console.error(
        `[POST /markNotificationRead] no se pudo marcar como leída la notificación ${id} (usuario ${usuario_id})`,
        err,
      );
      res.status(400).json({ msg: "No se pudo marcar como leída", error: err });
      throw new Error("No se pudo marcar como leída", err);
    });

  console.log(
    `[POST /markNotificationRead] notificación ${id} marcada como leída (usuario ${usuario_id})`,
  );

  return res.status(200).json(result);
});

module.exports = router;
