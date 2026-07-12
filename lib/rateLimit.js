const cache = require("./cache");

// Rate limiting simple en memoria (reutiliza el mismo Cache de lib/cache.js,
// sin agregar una librería nueva como express-rate-limit). No es exacto bajo
// alta concurrencia (hay una carrera leer-luego-escribir entre get/set) ni
// se comparte entre instancias/cold starts serverless, pero es suficiente
// para frenar fuerza bruta básica en /login y /forgotPassword.
function rateLimit({ windowMs, max, keyPrefix }) {
  return (req, res, next) => {
    const identifier = req.ip || req.socket?.remoteAddress || "unknown";
    const key = `${keyPrefix}:${identifier}`;
    const entry = cache.get(key) || { count: 0 };

    if (entry.count >= max) {
      return res.status(429).json({
        msg: "Demasiados intentos. Intente de nuevo en unos minutos.",
      });
    }

    cache.set(key, { count: entry.count + 1 }, windowMs);
    next();
  };
}

module.exports = rateLimit;
