const express = require("express");
const router = express.Router();
const db = require("../../lib/db");

router.get("/", async (req, res) => {
  const basicFormValues = await db
    .query("call basicFormValues()")
    .catch((err) => {
      res.status(400).json({
        msg: "No se pudo conseguir la información de los valores para el formulario BASICS",
      });
      throw new Error(
        "No se pudo conseguir la información de los valores para el formulario BASICS",
        err,
      );
    });

  const adminFormValues = await db
    .query("call adminFormValues()")
    .catch((err) => {
      res.status(400).json({
        msg: "No se pudo conseguir la información de los valores para el formulario BASICS",
      });
      throw new Error(
        "No se pudo conseguir la información de los valores para el formulario BASICS",
        err,
      );
    });

  const peopleFormValues = await db
    .query("call peopleFormValues()")
    .catch((err) => {
      res.status(400).json({
        msg: "No se pudo conseguir la información de los valores para el formulario BASICS",
      });
      throw new Error(
        "No se pudo conseguir la información de los valores para el formulario BASICS",
        err,
      );
    });

  const data = {
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

  return res.status(200).json(data);
});

module.exports = router;
