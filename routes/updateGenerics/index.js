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

  console.log(formData);

  const table = formData.table;
  const id = formData.id;

  delete formData.table
  delete formData.id

  const genericUpdate = await db
    .update(
      table,
formData,
      "id = ?",
      [id],
    )
    .catch((err) => {
      res.status(400).json({
        msg: `No se pudo actualizar la información genérica`,
        error: err,
      });
      throw new Error(`No se pudo actualizar la información genérica` + err);
    });

  return res.status(200).json(genericUpdate);
});

module.exports = router;
