const express = require("express");
const router = express.Router();
const db = require("../../lib/db");

router.get("/:projectId", async (req, res) => {
  const { projectId } = req.params;

  if (!projectId) {
    res.status(400).json({ msg: "Petición inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const imagesData = await db
    .select("proyectos_locations_img", {
      values: "*",
      where: "proyecto_id = ?",
      params: [projectId],
    })
    .catch((err) => {
      res.status(400).json({
        msg: "No se pudo conseguir la información de las imágenes de ubicación",
      });
      throw new Error(
        "No se pudo conseguir la información de las imágenes de ubicación",
        err,
      );
    });

  return res.status(200).json(imagesData);
});

module.exports = router;
