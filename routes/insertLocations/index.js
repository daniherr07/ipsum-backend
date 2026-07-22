const express = require("express");
const router = express.Router();
const db = require("../../lib/db");
const cache = require("../../lib/cache");

router.post("/", async (req, res) => {
  if (!req.body) {
    console.log(req.body);
    res
      .status(400)
      .json({ msg: "Petición de login inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const { locationForm, proyecto_id } = req.body;
  console.log(
    `[POST /insertLocations] actualizando información de ubicación del proyecto ${proyecto_id}`,
  );

  if (!locationForm || typeof locationForm !== "object") {
    console.warn(
      `[POST /insertLocations] falta locationForm en la petición (proyecto ${proyecto_id})`,
    );
    return res.status(400).json({ msg: "Faltan los datos de ubicación del proyecto" });
  }

  const locationsUpdate = await db
    .update("proyectos_locations", locationForm, "proyecto_id = ?", [
      proyecto_id,
    ])
    .catch((err) => {
      console.error(
        `[POST /insertLocations] no se pudo actualizar la información de locación (proyecto ${proyecto_id})`,
        err,
      );
      res.status(400).json({
        msg: `No se pudo actualizar la información de locación`,
        error: err,
      });
      throw new Error(`No se pudo actualizar la información de locación` + err);
    });

  // provincia/cantón/distrito se muestran en el listado de /allProjects.
  cache.delete("allProjects");

  console.log(
    `[POST /insertLocations] información de ubicación actualizada correctamente (proyecto ${proyecto_id})`,
  );

  return res.status(200).json(locationsUpdate);
});

module.exports = router;
