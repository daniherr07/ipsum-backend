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

  const formData = req.body;
  console.log(`[POST /updateUsers] actualizando usuario id ${formData.id}`);

  const parsedRolId = parseInt(formData.rol_id);
  if (Number.isNaN(parsedRolId)) {
    console.warn(`[POST /updateUsers] rol_id inválido: ${JSON.stringify(formData.rol_id)} (usuario ${formData.id})`);
    return res.status(400).json({ msg: "El rol indicado no es válido" });
  }

  const userUpdate = await db
    .update(
      "usuarios",
      {
        nombre: formData.nombre,
        apellido1: formData.apellido1,
        apellido2: formData.apellido2,
        correo_electronico: formData.correo_electronico,
        rol_id: parsedRolId,
      },
      "id = ?",
      [formData.id],
    )
    .catch((err) => {
      const msg =
        err.code === "ER_DUP_ENTRY"
          ? "Ya existe un usuario con ese correo electrónico"
          : "No se pudo actualizar la información del usuario";
      console.error(`[POST /updateUsers] ${msg} (usuario ${formData.id})`, err);
      res.status(400).json({ msg, error: err });
      throw new Error(`No se pudo actualizar la información del usuario` + err);
    });

  console.log(`[POST /updateUsers] usuario ${formData.id} actualizado correctamente`);

  cache.delete("selectUsers");
  cache.delete("formValues");

  return res.status(200).json(userUpdate);
});

module.exports = router;
