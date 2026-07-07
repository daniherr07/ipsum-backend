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

  const projectName = await db
    .select("proyectos_new", {
      values: "nombre, slug",
      where: "id = ?",
      params: [projectID],
    })
    .catch((err) => {
      res
        .status(400)
        .json({ msg: "No se pudo conseguir la información del proyecto" });
      throw new Error("No se pudo conseguir la información del proyecto", err);
    });

  const basicsData = await basics(projectID);
  const familiesData = await families(projectID);
  const locationsData = await locations(projectID);
  const adminsData = await admins(projectID);
  const peopleData = await people(projectID);

  const stagesData = await stages(projectID);
  return res
    .status(200)
    .json({
      projectName: projectName[0],
      projectSlug: projectName[0],
      basicsData,
      familiesData,
      locationsData,
      adminsData,
      peopleData,
      stagesData
    });
});

module.exports = router;
