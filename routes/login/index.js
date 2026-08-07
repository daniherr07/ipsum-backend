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
  // Log de diagnóstico permanente (no solo para depurar un incidente
  // puntual): en Vercel no hay acceso a un debugger ni stack trace en vivo,
  // así que esto es lo único que permite confirmar, mirando los logs, que
  // la petición llegó al backend en absoluto (si nunca aparece, el problema
  // es de red/DNS/URL mal armada del lado del frontend, no del backend).
  // OJO: nunca loguear req.body completo ni la contraseña acá, solo claves.
  console.log("[POST /login] petición recibida, body:", req.body ? Object.keys(req.body) : req.body);

  if (!req.body) {
    console.log(req.body);
    res
      .status(400)
      .json({ msg: "Petición de login inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const { email, password } = req.body;
  console.log("[POST /login] email recibido:", email);

  // Sin este chequeo, un email/password vacío (ej. el frontend manda el
  // form incompleto) llegaba tal cual a db.select/comparePassword: mysql2
  // rechaza params undefined con un error que el catch de abajo reportaba
  // como "no se pudo conectar con la base de datos" — un mensaje engañoso
  // para lo que en realidad es un dato faltante, no un problema de conexión.
  if (!email || !password) {
    console.warn("[POST /login] falta email o password en la petición");
    return res.status(400).json({ msg: "Correo y contraseña son requeridos" });
  }

  // Solo correo electrónico, no nombre de usuario (antes se aceptaban
  // ambos con "nombre = ? or correo_electronico = ?"). activated = 1
  // excluye usuarios "eliminados" (ver routes/deleteUser, borrado lógico) —
  // sin este filtro, un usuario eliminado podía seguir iniciando sesión.
  let userSelect;
  try {
    userSelect = await db.select("usuarios", {
      values: "*",
      where: "correo_electronico = ? and activated = 1",
      params: [email],
    });
  } catch (error) {
    // Si esto es lo que aparece en los logs, el problema es de conexión a
    // la base de datos (credenciales/firewall/host), no del login en sí.
    console.error("[POST /login] error consultando la base de datos:", error);
    return res.status(500).json({ msg: "No se pudo conectar con la base de datos" });
  }

  console.log("[POST /login] usuarios encontrados:", userSelect.length);

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

  console.log("[POST /login] contraseña coincide:", isMatch);

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

  console.log(`[POST /login] login exitoso (usuario id ${user.id})`);

  // No se devuelve el hash de la contraseña al cliente.
  // eslint-disable-next-line no-unused-vars
  const { password: _password, ...userWithoutPassword } = user;
  return res.status(200).json(userWithoutPassword);
});

module.exports = router;
