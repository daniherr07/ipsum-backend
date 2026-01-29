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

  const {basicsForm, proyecto_id} = req.body;
  basicsForm.fis = basicsForm.fis ? 1 : 0;
  basicsForm.grupo_id = parseInt(basicsForm.grupo_id)
  basicsForm.bono_id = parseInt(basicsForm.bono_id)
  basicsForm.variante_bono_id = parseInt(basicsForm.variante_bono_id)
  

  const basicsUpdate = await db
    .update("proyectos_basics", basicsForm, "proyecto_id = ?", [proyecto_id])
    .catch((err) => {
      res.status(400).json({
        msg: `No se pudo actualizar la información basica`,
        error: err,
      });
      throw new Error(`No se pudo actualizar la información basica` + err);
    });

  return res.status(200).json(basicsUpdate);
});

module.exports = router;
