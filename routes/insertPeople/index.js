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

  const { peopleForm, proyecto_id } = req.body;
  console.log(
    `[POST /insertPeople] actualizando encargados del proyecto ${proyecto_id}`,
  );

  if (!peopleForm || typeof peopleForm !== "object") {
    console.warn(
      `[POST /insertPeople] falta peopleForm en la petición (proyecto ${proyecto_id})`,
    );
    return res.status(400).json({ msg: "Faltan los datos de encargados del proyecto" });
  }

  const ids = [
    "constructor_id",
    "arquitecto_id",
    "promotor_id",
    "analista_id",
    "ingeniero_id",
    "fiscal_id",
  ];

  ids.forEach((key) => {
    peopleForm[key] =
      peopleForm[key] === "" || peopleForm[key] == null
        ? null
        : Number(peopleForm[key]);
  });

  const peopleUpdate = await db
    .update("proyectos_people", peopleForm, "proyecto_id = ?", [proyecto_id])
    .catch((err) => {
      console.error(
        `[POST /insertPeople] no se pudo actualizar los encargados (proyecto ${proyecto_id})`,
        err,
      );
      res.status(400).json({
        msg: `No se pudo actualizar la información basica`,
        error: err,
      });
      throw new Error(`No se pudo actualizar la información basica` + err);
    });

  // constructor/arquitecto/promotor/analista/ingeniero/fiscal se muestran
  // en el listado de /allProjects.
  cache.delete("allProjects");

  console.log(
    `[POST /insertPeople] encargados actualizados correctamente (proyecto ${proyecto_id})`,
  );

  return res.status(200).json(peopleUpdate);
});

module.exports = router;
