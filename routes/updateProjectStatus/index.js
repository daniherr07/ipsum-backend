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
  console.log(
    `[POST /updateProjectStatus] actualizando estado del proyecto ${proyecto_id} (activo: ${activo})`,
  );

  if (!proyecto_id || (activo !== 0 && activo !== 1)) {
    console.warn(
      `[POST /updateProjectStatus] datos inválidos (proyecto ${proyecto_id}, activo ${activo})`,
    );
    return res.status(400).json({ msg: "Faltan datos para actualizar el proyecto" });
  }

  const result = await db
    .update("proyectos_new", { activo }, "id = ?", [proyecto_id])
    .catch((err) => {
      console.error(
        `[POST /updateProjectStatus] no se pudo actualizar el estado del proyecto ${proyecto_id}`,
        err,
      );
      res.status(400).json({
        msg: "No se pudo actualizar el estado del proyecto",
        error: err,
      });
      throw new Error("No se pudo actualizar el estado del proyecto", err);
    });

  // activo determina si el proyecto sale en el listado por defecto de
  // /allProjects (ver SearchFilters.jsx: "Mostrar descartados").
  cache.delete("allProjects");

  console.log(
    `[POST /updateProjectStatus] estado del proyecto ${proyecto_id} actualizado correctamente`,
  );

  return res.status(200).json(result);
});

module.exports = router;
