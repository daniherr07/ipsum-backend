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
    `[POST /deleteAllNotifications] borrando todas las notificaciones del usuario ${usuario_id}`,
  );

  if (!usuario_id) {
    console.warn("[POST /deleteAllNotifications] falta usuario_id en la petición");
    return res.status(400).json({ msg: "Falta el usuario" });
  }

  const result = await db
    .delete("notificaciones", "usuario_id = ?", [usuario_id])
    .catch((err) => {
      console.error(
        `[POST /deleteAllNotifications] no se pudieron borrar las notificaciones del usuario ${usuario_id}`,
        err,
      );
      res.status(400).json({
        msg: "No se pudieron borrar las notificaciones",
        error: err,
      });
      throw new Error("No se pudieron borrar las notificaciones", err);
    });

  console.log(
    `[POST /deleteAllNotifications] notificaciones del usuario ${usuario_id} borradas correctamente`,
  );

  return res.status(200).json(result);
});

module.exports = router;
