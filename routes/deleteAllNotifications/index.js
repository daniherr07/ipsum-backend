const express = require("express");
const router = express.Router();
const db = require("../../lib/db");

router.post("/", async (req, res) => {
  if (!req.body) {
    res.status(400).json({ msg: "Petición inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const { usuario_id } = req.body;

  if (!usuario_id) {
    return res.status(400).json({ msg: "Falta el usuario" });
  }

  const result = await db
    .delete("notificaciones", "usuario_id = ?", [usuario_id])
    .catch((err) => {
      res.status(400).json({
        msg: "No se pudieron borrar las notificaciones",
        error: err,
      });
      throw new Error("No se pudieron borrar las notificaciones", err);
    });

  return res.status(200).json(result);
});

module.exports = router;
