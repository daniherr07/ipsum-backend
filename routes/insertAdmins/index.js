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

  const { adminForm, proyecto_id } = req.body;
  console.log(
    `[POST /insertAdmins] actualizando información administrativa del proyecto ${proyecto_id}`,
  );

  if (!adminForm || typeof adminForm !== "object") {
    console.warn(
      `[POST /insertAdmins] falta adminForm en la petición (proyecto ${proyecto_id})`,
    );
    return res.status(400).json({ msg: "Faltan los datos administrativos del proyecto" });
  }

  const ids = ["entidad_id", "centro_negocio_id", "analista_entidad_id"];

  ids.forEach((key) => {
    adminForm[key] =
      adminForm[key] === "" || adminForm[key] == null
        ? null
        : Number(adminForm[key]);
  });

  const adminUpdate = await db
    .update("proyectos_admins", adminForm, "proyecto_id = ?", [proyecto_id])
    .catch((err) => {
      console.error(
        `[POST /insertAdmins] no se pudo actualizar la información administrativa (proyecto ${proyecto_id})`,
        { datosEnviados: adminForm, error: { message: err.message, code: err.code, sqlMessage: err.sqlMessage } },
      );
      res.status(400).json({
        msg: `No se pudo actualizar la información administrativa`,
        error: err,
      });
      throw new Error(
        `No se pudo actualizar la información administrativa` + err,
      );
    });

  // entidad/centro de negocios se muestran en el listado de /allProjects.
  cache.delete("allProjects");

  console.log(
    `[POST /insertAdmins] información administrativa actualizada correctamente (proyecto ${proyecto_id})`,
  );

  return res.status(200).json(adminUpdate);
});

module.exports = router;
