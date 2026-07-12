const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();

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

/** Middleware para detección de errores. Debe registrarse DESPUÉS de las
 * rutas: Express solo enruta un error hacia un error-handler registrado más
 * adelante en el stack que el punto donde ocurrió — antes vivía arriba de
 * las rutas y por eso nunca se ejecutaba para ningún throw/rechazo dentro
 * de un route handler. */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
