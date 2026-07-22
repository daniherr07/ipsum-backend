const express = require("express");
const router = express.Router();
const db = require("../../lib/db");
const bcrypt = require("bcrypt");
const cache = require("../../lib/cache");

const saltRounds = 10;

router.post("/", async (req, res) => {
  if (!req.body) {
    console.log(req.body);
    res
      .status(400)
      .json({ msg: "Petición de creación de usuario inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const { nombre, apellido1, apellido2, correo_electronico, rol_id } = req.body;
  // No loguear la contraseña (ni la genérica ni el hash); el correo es el
  // único dato semi-sensible acá y ayuda a rastrear "¿a quién se le creó
  // cuenta?" en los logs de producción.
  console.log(`[POST /insertUser] creando usuario ${correo_electronico} (rol_id ${rol_id})`);

  const parsedRolId = parseInt(rol_id);
  if (Number.isNaN(parsedRolId)) {
    console.warn(`[POST /insertUser] rol_id inválido: ${JSON.stringify(rol_id)}`);
    return res.status(400).json({ msg: "El rol indicado no es válido" });
  }

  const existing = await db.select("usuarios", {
    values: "id",
    where: "correo_electronico = ?",
    params: [correo_electronico],
  });

  if (existing && existing.length > 0) {
    console.warn(`[POST /insertUser] correo duplicado: ${correo_electronico}`);
    return res
      .status(400)
      .json({ msg: "Ya existe un usuario con ese correo electrónico" });
  }

  // Todo usuario nuevo arranca con la contraseña genérica definida en DEFAULT_PASS;
  // el usuario la cambia por su cuenta la primera vez que inicia sesión.
  const hashedPassword = await bcrypt.hash(process.env.DEFAULT_PASS, saltRounds);

  const userInsert = await db
    .insert("usuarios", {
      nombre,
      apellido1,
      apellido2,
      correo_electronico,
      rol_id: parsedRolId,
      password: hashedPassword,
    })
    .catch((err) => {
      console.error(`[POST /insertUser] no se pudo crear el usuario ${correo_electronico}`, err);
      res.status(400).json({
        msg: "No se pudo crear el usuario",
        error: err,
      });
      throw new Error("No se pudo crear el usuario", err);
    });

  console.log(`[POST /insertUser] usuario creado (id ${userInsert.insertId})`);

  // El usuario nuevo debe aparecer de inmediato en /selectUsers, y puede
  // afectar las listas de arquitectos/analistas/ingenieros de /formValues.
  cache.delete("selectUsers");
  cache.delete("formValues");

  return res.status(200).json(userInsert);
});

module.exports = router;
