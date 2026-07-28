const express = require("express");
const router = express.Router();
const db = require("../../lib/db");

router.get("/:projectId", async (req, res) => {
  const { projectId } = req.params;
  console.log(`[GET /getBitacora/:projectId] consultando notas del proyecto ${projectId}`);

  if (!projectId) {
    res.status(400).json({ msg: "Petición inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const bitacoraEntries = await db
    .query("call getNotes(?)", [projectId])
    .catch((err) => {
      console.error(
        `[GET /getBitacora/:projectId] no se pudo conseguir las notas del proyecto ${projectId}`,
        err,
      );
      res.status(400).json({
        msg: "No se pudo conseguir la información de las Notas",
      });
      throw new Error(
        "No se pudo conseguir la información de las Notas",
        err,
      );
    });

  return res.status(200).json(bitacoraEntries);
});

module.exports = router;
