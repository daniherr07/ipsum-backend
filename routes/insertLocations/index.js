const express = require("express");
const router = express.Router();
const db = require("../../lib/db");

router.post("/", async (req, res) => {
  if (!req.body) {
    console.log(req.body);
    res
      .status(400)
      .json({ msg: "Petición de login inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const { locationForm, proyecto_id } = req.body;

  const locationsUpdate = await db
    .update("proyectos_locations", locationForm, "proyecto_id = ?", [
      proyecto_id,
    ])
    .catch((err) => {
      res.status(400).json({
        msg: `No se pudo actualizar la información de locación`,
        error: err,
      });
      throw new Error(`No se pudo actualizar la información de locación` + err);
    });

  return res.status(200).json(locationsUpdate);
});

module.exports = router;
