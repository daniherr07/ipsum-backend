const express = require("express");
const router = express.Router();
const db = require("../../lib/db");

router.post("/", async (req, res) => {
  if (!req.body) {
    res.status(400).json({ msg: "Petición inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const { usuario_id } = req.body;
  console.log(
    `[POST /markAllNotificationsRead] marcando todas las notificaciones como leídas (usuario ${usuario_id})`,
  );

  if (!usuario_id) {
    console.warn("[POST /markAllNotificationsRead] falta usuario_id en la petición");
    return res.status(400).json({ msg: "Falta el usuario" });
  }

  const result = await db
    .update("notificaciones", { leido: 1 }, "usuario_id = ? and leido = 0", [
      usuario_id,
    ])
    .catch((err) => {
      console.error(
        `[POST /markAllNotificationsRead] no se pudieron marcar como leídas (usuario ${usuario_id})`,
        err,
      );
      res.status(400).json({
        msg: "No se pudieron marcar como leídas",
        error: err,
      });
      throw new Error("No se pudieron marcar como leídas", err);
    });

  console.log(
    `[POST /markAllNotificationsRead] notificaciones marcadas como leídas (usuario ${usuario_id})`,
  );

  return res.status(200).json(result);
});

module.exports = router;
