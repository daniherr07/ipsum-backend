const express = require("express");
const router = express.Router();
const db = require("../../lib/db");
const comparePassword = require("../../lib/comparePassword");
const rateLimit = require("../../lib/rateLimit");

// 15 intentos cada 15 minutos por IP: suficiente para un usuario que se
// equivoca escribiendo la contraseña, no para fuerza bruta.
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  keyPrefix: "login",
});

router.post("/", loginRateLimit, async (req, res) => {
  if (!req.body) {
    console.log(req.body);
    res
      .status(400)
      .json({ msg: "Petición de login inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const { email, password } = req.body;

  // Solo correo electrónico, no nombre de usuario (antes se aceptaban
  // ambos con "nombre = ? or correo_electronico = ?"). activated = 1
  // excluye usuarios "eliminados" (ver routes/deleteUser, borrado lógico) —
  // sin este filtro, un usuario eliminado podía seguir iniciando sesión.
  const userSelect = await db.select("usuarios", {
    values: "*",
    where: "correo_electronico = ? and activated = 1",
    params: [email],
  });

  if (!userSelect || userSelect.length == 0) {
    return res.status(400).json({ msg: "Usuario o contraseña incorrectos" });
  }

  const user = userSelect[0];

  let isMatch;
  try {
    isMatch = await comparePassword(password, user.password);
  } catch (error) {
    console.error("Error comparando contraseñas", error);
    return res.status(500).json({ msg: "No se pudo validar el usuario" });
  }

  if (!isMatch) {
    return res.status(400).json({ msg: "Usuario o contraseña incorrectos" });
  }

  // estado = 0: usuario nuevo (o que acaba de pedir "olvidé mi contraseña")
  // que todavía tiene la contraseña genérica/temporal. No se le deja entrar
  // directo: primero tiene que cambiarla (ver /changePassword), que es
  // quien finalmente pone estado = 1 y lo deja pasar.
  if (user.estado == 0) {
    return res.status(200).json({
      requiresPasswordChange: true,
      id: user.id,
      nombre: user.nombre,
    });
  }

  // No se devuelve el hash de la contraseña al cliente.
  // eslint-disable-next-line no-unused-vars
  const { password: _password, ...userWithoutPassword } = user;
  return res.status(200).json(userWithoutPassword);
});

module.exports = router;
