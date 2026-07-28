const express = require("express");
const router = express.Router();
const db = require("../../lib/db");

const basics = require("../../lib/select/selectBasics");
const families = require("../../lib/select/selectFamilies");
const locations = require("../../lib/select/selectLocations");
const admins = require("../../lib/select/selectAdmin");
const people = require("../../lib/select/selectPeople");
const stages = require("../../lib/select/selectStages");

router.get("/:projectID", async (req, res) => {
  const { projectID } = req.params;

  if (!projectID) {
    console.log(req.body);
    res.status(400).json({ msg: "Petición inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  // Las 7 consultas leen tablas distintas del mismo proyecto y no dependen
  // entre sí, así que se disparan en paralelo en vez de una tras otra
  // (antes eran 7 idas y vueltas secuenciales a la base de datos por cada
  // carga del editor de proyecto).
  const [projectName, basicsData, familiesData, locationsData, adminsData, peopleData, stagesData] =
    await Promise.all([
      db
        .select("proyectos_new", {
          values: "nombre, slug",
          where: "id = ?",
          params: [projectID],
        })
        .catch((err) => {
          res.status(400).json({
            msg: "No se pudo conseguir la información del proyecto",
          });
          throw new Error(
            "No se pudo conseguir la información del proyecto",
            err,
          );
        }),
      basics(projectID),
      families(projectID),
      locations(projectID),
      admins(projectID),
      people(projectID),
      stages(projectID),
    ]);

  // proyectos_new no tiene fila con este id (borrado, id inventado, o una
  // condición de carrera con un delete) — antes esto seguía de largo y
  // explotaba con "Cannot read properties of undefined (reading 'slug')"
  // en la línea de abajo, devolviendo un 500 genérico en vez de un error
  // claro.
  if (!projectName || projectName.length === 0) {
    console.warn(`[GET /projectData/${projectID}] no existe ese proyecto`);
    return res.status(404).json({ msg: "El proyecto no existe" });
  }

  return res.status(200).json({
    projectName: projectName[0],
    projectSlug: projectName[0].slug,
    basicsData,
    familiesData,
    locationsData,
    adminsData,
    peopleData,
    stagesData,
  });
});

module.exports = router;
