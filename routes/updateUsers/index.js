const express = require("express");
const router = express.Router();
const db = require("../../lib/db");
const cache = require("../../lib/cache");

router.post("/", async (req, res) => {
  if (!req.body) {
    console.log(req.body);
    res
      .status(400)
      .json({ msg: "Petición de login inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const formData = req.body;

  const userUpdate = await db
    .update(
      "usuarios",
      {
        nombre: formData.nombre,
        apellido1: formData.apellido1,
        apellido2: formData.apellido2,
        correo_electronico: formData.correo_electronico,
        rol_id: parseInt(formData.rol_id),
      },
      "id = ?",
      [formData.id],
    )
    .catch((err) => {
      res.status(400).json({
        msg: `No se pudo actualizar la información del usuario`,
        error: err,
      });
      throw new Error(`No se pudo actualizar la información del usuario` + err);
    });

  cache.delete("selectUsers");
  cache.delete("formValues");

  return res.status(200).json(userUpdate);
});

module.exports = router;
