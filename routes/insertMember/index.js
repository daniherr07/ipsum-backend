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
  delete formData.img_file;

  const memberInsert = await db
    .insert("proyectos_families", formData)
    .catch((err) => {
      res.status(400).json({
        msg: `No se pudo insertar el miembro`,
        error: err,
      });
      throw new Error(`No se pudo insertar el miembro` + err);
    });

  return res.status(200).json(memberInsert);
});

module.exports = router;
