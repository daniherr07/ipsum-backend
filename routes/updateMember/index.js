const express = require("express");
const router = express.Router();
const db = require("../../lib/db");

router.post("/", async (req, res) => {
  if (!req.body) {
    console.log(req.body);
    res
      .status(400)
      .json({ msg: "Petición de actualización inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const formData = req.body;
  delete formData.img_file;

  // db_id es la llave primaria real de proyectos_families. Se usa para
  // identificar la fila en vez de "id" (la cédula), porque justamente la
  // cédula puede ser uno de los campos que se está editando.
  const dbId = formData.db_id;
  delete formData.db_id;
  delete formData.proyecto_id;
  console.log(`[POST /updateMember] actualizando miembro de familia (db_id ${dbId})`);

  const memberUpdate = await db
    .update("proyectos_families", formData, "db_id = ?", [dbId])
    .catch((err) => {
      console.error(
        `[POST /updateMember] no se pudo actualizar el miembro (db_id ${dbId})`,
        err,
      );
      res.status(400).json({
        msg: "No se pudo actualizar el miembro",
        error: err,
      });
      throw new Error("No se pudo actualizar el miembro", err);
    });

  console.log(`[POST /updateMember] miembro actualizado correctamente (db_id ${dbId})`);

  return res.status(200).json(memberUpdate);
});

module.exports = router;
