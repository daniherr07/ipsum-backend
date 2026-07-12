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
      .json({ msg: "Petición de login inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const formData = req.body;

  const table = formData.table;
  const id = formData.id;

  if (!ALLOWED_GENERIC_TABLES.includes(table)) {
    return res.status(400).json({ msg: "Tabla no permitida" });
  }

  delete formData.table;
  delete formData.id;

  const genericUpdate = await db
    .update(table, formData, "id = ?", [id])
    .catch((err) => {
      res.status(400).json({
        msg: `No se pudo actualizar la información genérica`,
        error: err,
      });
      throw new Error(`No se pudo actualizar la información genérica` + err);
    });

  cache.delete(`generics:${table}`);
  cache.delete("formValues");

  return res.status(200).json(genericUpdate);
});

module.exports = router;
