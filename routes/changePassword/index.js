const express = require("express");
const router = express.Router();
const db = require("../../lib/db");
const bcrypt = require("bcrypt");
const comparePassword = require("../../lib/comparePassword");

const saltRounds = 10;

// Se usa cuando /login devuelve requiresPasswordChange (estado = 0): el
// usuario todavía debe probar que conoce la contraseña ACTUAL (genérica o
// temporal) antes de poder ponerse una nueva — si no, cualquiera que
// adivinara/conociera un id de usuario podría tomar la cuenta sin conocer
// la contraseña, solo visitando esta pantalla directo.
router.post("/", async (req, res) => {
  if (!req.body) {
    res.status(400).json({ msg: "Petición inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const { id, currentPassword, newPassword } = req.body;

  if (!id || !currentPassword || !newPassword) {
    return res.status(400).json({ msg: "Faltan datos" });
  }

  if (newPassword.length < 8) {
    return res
      .status(400)
      .json({ msg: "La nueva contraseña debe tener al menos 8 caracteres" });
  }

  const userSelect = await db.select("usuarios", {
    values: "*",
    where: "id = ?",
    params: [id],
  });

  if (!userSelect || userSelect.length === 0) {
    return res.status(400).json({ msg: "Usuario no encontrado" });
  }

  const user = userSelect[0];

  let isMatch;
  try {
    isMatch = await comparePassword(currentPassword, user.password);
  } catch (error) {
    console.error("Error comparando contraseñas", error);
    return res.status(500).json({ msg: "No se pudo validar el usuario" });
  }

  if (!isMatch) {
    return res.status(400).json({ msg: "La contraseña actual es incorrecta" });
  }

  const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

  await db
    .update(
      "usuarios",
      { password: hashedPassword, estado: 1 },
      "id = ?",
      [id],
    )
    .catch((err) => {
      res.status(400).json({ msg: "No se pudo actualizar la contraseña", error: err });
      throw new Error("No se pudo actualizar la contraseña", err);
    });

  // Contraseña cambiada con éxito: ya es un usuario regular (estado = 1),
  // se le deja entrar de una vez sin pedirle que inicie sesión de nuevo.
  // eslint-disable-next-line no-unused-vars
  const { password: _password, ...userWithoutPassword } = user;
  return res.status(200).json({ ...userWithoutPassword, estado: 1 });
});

module.exports = router;
