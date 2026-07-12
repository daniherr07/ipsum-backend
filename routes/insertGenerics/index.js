const express = require("express");
const router = express.Router();
const db = require("../../lib/db");
const cache = require("../../lib/cache");
const ALLOWED_GENERIC_TABLES = require("../../lib/genericTables");

router.post("/", async (req, res) => {
  if (!req.body) {
    console.log(req.body);
    res
      .status(400)
      .json({ msg: "Petición de creación inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const formData = req.body;
  const table = formData.table;

  if (!ALLOWED_GENERIC_TABLES.includes(table)) {
    return res.status(400).json({ msg: "Tabla no permitida" });
  }

  // El nombre de la tabla viaja junto con los campos del formulario;
  // se separa antes de insertar para no intentar guardarlo como columna.
  delete formData.table;

  const genericInsert = await db
    .insert(table, formData)
    .catch((err) => {
      res.status(400).json({
        msg: "No se pudo crear el registro genérico",
        error: err,
      });
      throw new Error("No se pudo crear el registro genérico", err);
    });

  // El nuevo registro debe verse de inmediato en /generics/:table y en
  // /formValues (que agrega varias de estas tablas), no hasta que expire
  // el TTL de sus cachés.
  cache.delete(`generics:${table}`);
  cache.delete("formValues");

  return res.status(200).json(genericInsert);
});

module.exports = router;
