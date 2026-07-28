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
  console.log(`[POST /insertGenerics] creando registro en tabla genérica "${table}"`);

  if (!ALLOWED_GENERIC_TABLES.includes(table)) {
    console.warn(`[POST /insertGenerics] tabla no permitida: "${table}"`);
    return res.status(400).json({ msg: "Tabla no permitida" });
  }

  // El nombre de la tabla viaja junto con los campos del formulario;
  // se separa antes de insertar para no intentar guardarlo como columna.
  delete formData.table;

  const genericInsert = await db
    .insert(table, formData)
    .catch((err) => {
      // ER_DUP_ENTRY: alguna columna de esta tabla tiene una restricción de
      // valor único (ej. entidades.nombre) y ya existe un registro con ese
      // mismo valor. Mensaje claro en vez del error crudo de MySQL.
      console.error(
        `[POST /insertGenerics] no se pudo crear el registro en la tabla "${table}"`,
        err,
      );
      const msg =
        err.code === "ER_DUP_ENTRY"
          ? "Ya existe un registro con ese mismo nombre/valor"
          : "No se pudo crear el registro genérico";
      res.status(400).json({ msg, error: err });
      throw new Error("No se pudo crear el registro genérico", err);
    });

  // El nuevo registro debe verse de inmediato en /generics/:table y en
  // /formValues (que agrega varias de estas tablas), no hasta que expire
  // el TTL de sus cachés.
  cache.delete(`generics:${table}`);
  cache.delete("formValues");

  console.log(
    `[POST /insertGenerics] registro creado correctamente en la tabla "${table}"`,
  );

  return res.status(200).json(genericInsert);
});

module.exports = router;
