const express = require("express");
const router = express.Router();
const db = require("../../lib/db");

router.post("/", async (req, res) => {
  if (!req.body) {
    console.log(req.body);
    res
      .status(400)
      .json({ msg: "Petición de login inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const formData = req.body;
  console.log(
    `[POST /addBitacora] insertando nota de bitácora (proyecto ${formData.proyecto_id}, usuario ${formData.usuario_id}, tipo ${formData.tipo})`,
  );

  const bitacoraInsert = await db
    .insert("entradas_bitacora", formData)
    .catch((err) => {
      console.error(
        `[POST /addBitacora] no se pudo insertar la nota (proyecto ${formData.proyecto_id})`,
        err,
      );
      res.status(400).json({
        msg: `No se pudo insertar la nota`,
        error: err,
      });
      throw new Error(`No se pudo insertar la nota` + err);
    });

  console.log(
    `[POST /addBitacora] nota insertada correctamente (proyecto ${formData.proyecto_id})`,
  );

  return res.status(200).json(bitacoraInsert);
});

module.exports = router;
