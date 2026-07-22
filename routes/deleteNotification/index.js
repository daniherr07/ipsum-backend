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
    `[POST /deleteNotification] borrando notificación ${id} (usuario ${usuario_id})`,
  );

  if (!id || !usuario_id) {
    console.warn("[POST /deleteNotification] faltan id/usuario_id en la petición");
    return res.status(400).json({ msg: "Faltan datos" });
  }

  // Filtra también por usuario_id para que un usuario no pueda borrar una
  // notificación que no es suya.
  const result = await db
    .delete("notificaciones", "id = ? and usuario_id = ?", [id, usuario_id])
    .catch((err) => {
      console.error(
        `[POST /deleteNotification] no se pudo borrar la notificación ${id} (usuario ${usuario_id})`,
        err,
      );
      res.status(400).json({ msg: "No se pudo borrar la notificación", error: err });
      throw new Error("No se pudo borrar la notificación", err);
    });

  console.log(
    `[POST /deleteNotification] notificación ${id} borrada correctamente (usuario ${usuario_id})`,
  );

  return res.status(200).json(result);
});

module.exports = router;
