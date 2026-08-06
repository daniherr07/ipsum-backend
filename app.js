// Sentry.init() (adentro de instrument.js) tiene que correr ANTES que
// cualquier "require" de los paquetes que instrumenta (express, mysql2,
// etc.) — si no, Sentry no llega a tiempo de parchar esos módulos y avisa
// "express is not instrumented". Por eso esta línea va primera, antes que
// nada más, incluyendo el "require('express')" de abajo.
require("./instrument.js");

const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();

// Import with `import * as Sentry from "@sentry/node"` if you are using ESM
const Sentry = require("@sentry/node");

// Sin FRONTEND_URL, cors() se abre a cualquier origen (lo que ya venía
// pasando) — se mantiene así por defecto para no romper nada si no está
// configurado, pero avisa por consola para que no pase desapercibido.
const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (allowedOrigins.length === 0) {
  console.warn(
    "FRONTEND_URL no está configurado: CORS acepta cualquier origen. Defínelo en .env para restringirlo al frontend real.",
  );
}

app.use(cors(allowedOrigins.length > 0 ? { origin: allowedOrigins } : undefined));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/", require("./routes"));

// Igual que el error-handler propio de abajo: tiene que ir DESPUÉS de las
// rutas (para que Express lo enrute cuando algo falla adentro de ellas) pero
// ANTES del error-handler propio (para que Sentry alcance a ver el error
// antes de que la respuesta ya se haya mandado).
Sentry.setupExpressErrorHandler(app);

/** Middleware para detección de errores. Debe registrarse DESPUÉS de las
 * rutas: Express solo enruta un error hacia un error-handler registrado más
 * adelante en el stack que el punto donde ocurrió — antes vivía arriba de
 * las rutas y por eso nunca se ejecutaba para ningún throw/rechazo dentro
 * de un route handler. */
app.use((err, req, res, next) => {
  console.error(err.stack);
  // Casi todas las rutas siguen el patrón res.status(400).json({msg...})
  // seguido de throw (para reportar su propio error Y cortar la ejecución
  // con el error real, ver CLAUDE.md) — eso significa que cuando ESTE
  // middleware recibe el error, la respuesta original YA se mandó. Sin este
  // chequeo, intentar mandar una segunda respuesta explotaba con
  // "Cannot set headers after they are sent to the client" en cualquier
  // ruta que tomara ese camino (ej. crear una entidad con un nombre
  // duplicado), tumbando el proceso en vez de solo registrar el error.
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
