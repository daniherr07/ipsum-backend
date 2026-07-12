const express = require("express");
const router = express.Router();
const db = require("../../lib/db");
const cache = require("../../lib/cache");

router.post("/", async (req, res) => {
  if (!req.body) {
    res.status(400).json({ msg: "Petición inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const { proyecto_id, activo } = req.body;

  if (!proyecto_id || (activo !== 0 && activo !== 1)) {
    return res.status(400).json({ msg: "Faltan datos para actualizar el proyecto" });
  }

  const result = await db
    .update("proyectos_new", { activo }, "id = ?", [proyecto_id])
    .catch((err) => {
      res.status(400).json({
        msg: "No se pudo actualizar el estado del proyecto",
        error: err,
      });
      throw new Error("No se pudo actualizar el estado del proyecto", err);
    });

  // activo determina si el proyecto sale en el listado por defecto de
  // /allProjects (ver SearchFilters.jsx: "Mostrar descartados").
  cache.delete("allProjects");

  return res.status(200).json(result);
});

module.exports = router;
