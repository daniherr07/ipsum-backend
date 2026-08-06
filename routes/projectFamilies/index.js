const express = require("express");
const router = express.Router();
const selectFamilies = require("../../lib/select/selectFamilies");

// Versión liviana de /projectData solo para la lista de familiares — la
// vista previa de "Buscar" (para mostrar los contactos marcados) no necesita
// básicos/ubicación/administrativos/encargados, así que no tiene sentido
// pedir todo eso solo para leer proyectos_families.
router.get("/:projectId", async (req, res) => {
  const { projectId } = req.params;
  console.log(`[GET /projectFamilies/:projectId] consultando familiares del proyecto ${projectId}`);

  if (!projectId) {
    return res.status(400).json({ msg: "Falta el id del proyecto" });
  }

  const families = await selectFamilies(projectId).catch((err) => {
    console.error(
      `[GET /projectFamilies/:projectId] no se pudo consultar la familia (proyecto ${projectId})`,
      err,
    );
    res.status(400).json({ msg: "No se pudo consultar la familia", error: err });
    throw new Error("No se pudo consultar la familia", err);
  });

  return res.status(200).json(families);
});

module.exports = router;
