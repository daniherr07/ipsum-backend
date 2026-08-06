const express = require("express");
const router = express.Router();
const db = require("../../lib/db");
const cache = require("../../lib/cache");

router.post("/", async (req, res) => {
  console.log("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
  if (!req.body) {
    console.log(req.body);
    res
      .status(400)
      .json({ msg: "Petición de login inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const {basicsForm, proyecto_id} = req.body;

  console.log(basicsForm)

  if (!basicsForm || typeof basicsForm !== "object") {
    return res.status(400).json({ msg: "Faltan los datos básicos del proyecto" });
  }

  basicsForm.fis = basicsForm.fis ? 1 : 0;
  basicsForm.grupo_id = parseInt(basicsForm.grupo_id) ? parseInt(basicsForm.grupo_id) : null
  basicsForm.bono_id = parseInt(basicsForm.bono_id)? parseInt(basicsForm.bono_id) : null
  basicsForm.variante_bono_id = parseInt(basicsForm.variante_bono_id) ? parseInt(basicsForm.variante_bono_id) : null

  // Si alguno venía vacío/no-numérico, parseInt da NaN — sin este chequeo
  // se escribía NaN en una columna FK (int) de proyectos_basics.
  const invalidField = ["grupo_id", "bono_id", "variante_bono_id"].find(
    (key) => Number.isNaN(basicsForm[key]),
  );
  if (invalidField) {
    console.warn(
      `[POST /insertBasics] campo inválido "${invalidField}" para el proyecto ${proyecto_id}`,
    );
    return res.status(400).json({ msg: `El campo "${invalidField}" no es válido` });
  }

  const basicsUpdate = await db
    .update("proyectos_basics", basicsForm, "proyecto_id = ?", [proyecto_id])
    .catch((err) => {
      // Detalle completo con los datos involucrados (con esta misma
      // petición ya alcanza, sin ir a consultar nada más): a qué proyecto
      // era, y el cuerpo exacto que se intentó guardar.
      console.error(
        `[POST /insertBasics] no se pudo actualizar proyectos_basics (proyecto ${proyecto_id})`,
        { datosEnviados: basicsForm, error: { message: err.message, code: err.code, sqlMessage: err.sqlMessage } },
      );
      res.status(400).json({
        msg: `No se pudo actualizar la información basica`,
        error: err,
      });
      throw new Error(`No se pudo actualizar la información basica` + err);
    });

  // bono/variante/grupo se muestran en el listado de /allProjects.
  cache.delete("allProjects");

  console.log(basicsForm)

  return res.status(200).json(basicsUpdate);
});

module.exports = router;
