const express = require("express");
const router = express.Router();
const db = require("../../lib/db");
const cache = require("../../lib/cache");

// Los 3 stored procedures son independientes entre sí (cada uno arma las
// opciones de un formulario distinto), así que se piden en paralelo en vez
// de uno tras otro. El resultado combinado se cachea: son catálogos que
// casi no cambian y esta ruta se pide en cada carga del editor de proyecto.
// TTL de respaldo; insertGenerics/updateGenerics/insertUser/updateUsers
// invalidan el caché apenas cambia algo que estos procedures usan.
const CACHE_TTL_MS = 5 * 60_000;

router.get("/", async (req, res) => {
  console.log("[GET /formValues] consultando valores de formularios (cache o BD)");
  const data = await cache
    .getOrSet("formValues", CACHE_TTL_MS, async () => {
      const [basicFormValues, adminFormValues, peopleFormValues] =
        await Promise.all([
          db.query("call basicFormValues()"),
          db.query("call adminFormValues()"),
          db.query("call peopleFormValues()"),
        ]);

      return {
        basicFormValues: {
          bonos: basicFormValues[0],
          varbonos: basicFormValues[1],
          grupos: basicFormValues[2],
        },
        adminFormValues: {
          entidades: adminFormValues[0],
          centros_negocio: adminFormValues[1],
          analista_entidades: adminFormValues[2],
        },
        peopleFormValues: {
          constructores: peopleFormValues[0],
          arquitectos: peopleFormValues[1],
          promotores: peopleFormValues[2],
          analistas: peopleFormValues[3],
          ingenieros: peopleFormValues[4],
          fiscales: peopleFormValues[5],
        },
      };
    })
    .catch((err) => {
      console.error(
        "[GET /formValues] no se pudo conseguir la información de los valores para los formularios",
        err,
      );
      res.status(400).json({
        msg: "No se pudo conseguir la información de los valores para los formularios",
        error: err,
      });
      throw new Error(
        "No se pudo conseguir la información de los valores para los formularios",
        err,
      );
    });

  return res.status(200).json(data);
});

module.exports = router;
