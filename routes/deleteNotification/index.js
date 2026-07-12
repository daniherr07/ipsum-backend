const express = require("express");
const router = express.Router();
const db = require("../../lib/db");

router.post("/", async (req, res) => {
  if (!req.body) {
    res.status(400).json({ msg: "Petición inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const { id, usuario_id } = req.body;

  if (!id || !usuario_id) {
    return res.status(400).json({ msg: "Faltan datos" });
  }

  // Filtra también por usuario_id para que un usuario no pueda borrar una
  // notificación que no es suya.
  const result = await db
    .delete("notificaciones", "id = ? and usuario_id = ?", [id, usuario_id])
    .catch((err) => {
      res.status(400).json({ msg: "No se pudo borrar la notificación", error: err });
      throw new Error("No se pudo borrar la notificación", err);
    });

  return res.status(200).json(result);
});

module.exports = router;
