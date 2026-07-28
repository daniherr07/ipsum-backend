const express = require("express");
const router = express.Router();
const db = require("../../lib/db");

router.get("/:projectId", async (req, res) => {
  const { projectId } = req.params;
  console.log(
    `[GET /projectImages/:projectId] consultando fotos overview del proyecto ${projectId}`,
  );

  if (!projectId) {
    res.status(400).json({ msg: "Petición inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const imagesData = await db
    .select(`proyectos_photos`,
        {
            values: "*",
            where: "proyecto_id = ? order by id desc",
            params: [projectId]
        }
    )
    .catch((err) => {
      console.error(
        `[GET /projectImages/:projectId] no se pudo conseguir las fotos overview (proyecto ${projectId})`,
        err,
      );
      res.status(400).json({
        msg: "No se pudo conseguir la información de las Imagenes Overview",
      });
      throw new Error(
        "No se pudo conseguir la información de las  Imagenes Overview",
        err,
      );
    });

  return res.status(200).json(imagesData);
});

module.exports = router;
