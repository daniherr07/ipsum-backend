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

  const bitacoraInsert = await db
    .insert("entradas_bitacora", formData)
    .catch((err) => {
      res.status(400).json({
        msg: `No se pudo insertar la nota`,
        error: err,
      });
      throw new Error(`No se pudo insertar la nota` + err);
    });

  return res.status(200).json(bitacoraInsert);
});

module.exports = router;
