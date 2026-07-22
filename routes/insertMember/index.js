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
  console.log(
    `[POST /insertMember] insertando miembro de familia (proyecto ${formData.proyecto_id}, cédula ${formData.id})`,
  );

  const memberInsert = await db
    .insert("proyectos_families", formData)
    .catch((err) => {
      console.error(
        `[POST /insertMember] no se pudo insertar el miembro (proyecto ${formData.proyecto_id})`,
        err,
      );
      res.status(400).json({
        msg: `No se pudo insertar el miembro`,
        error: err,
      });
      throw new Error(`No se pudo insertar el miembro` + err);
    });

  console.log(
    `[POST /insertMember] miembro insertado correctamente (proyecto ${formData.proyecto_id}, db_id ${memberInsert?.insertId})`,
  );

  return res.status(200).json(memberInsert);
});

module.exports = router;
