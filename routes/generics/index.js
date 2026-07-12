const express = require("express");
const router = express.Router();
const db = require("../../lib/db");
const cache = require("../../lib/cache");
const ALLOWED_GENERIC_TABLES = require("../../lib/genericTables");

// Estas tablas son catálogos que casi no cambian (solo se editan desde la
// pantalla "Modificar"), y se piden en cada carga de Buscar/Modificar/el
// editor de proyecto. TTL de respaldo; la invalidación real ocurre en
// insertGenerics/updateGenerics apenas alguien edita la tabla.
const CACHE_TTL_MS = 5 * 60_000;

router.get("/:table", async (req, res) => {
  const { table } = req.params;

  if (!table) {
    res.status(400).json({ msg: "Petición inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  if (!ALLOWED_GENERIC_TABLES.includes(table)) {
    return res.status(400).json({ msg: "Tabla no permitida" });
  }

  const select = await cache
    .getOrSet(`generics:${table}`, CACHE_TTL_MS, () =>
      db.select(table, {
        values: "*",
        where: "",
        params: [],
      }),
    )
    .catch((err) => {
      res.status(400).json({
        msg: "No se pudo conseguir la información de esa tabla",
        error: err,
      });
      throw new Error("No se pudo conseguir la información de esa tabla", err);
    });

  return res.status(200).json(select);
});

module.exports = router;
