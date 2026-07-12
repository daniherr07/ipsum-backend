const express = require("express");
const router = express.Router();
const db = require("../../lib/db");
const cache = require("../../lib/cache");

// usuarios y roles son independientes; se piden en paralelo. roles casi
// nunca cambia y usuarios solo cambia cuando alguien crea/edita un usuario
// (rutas insertUser/updateUsers, que invalidan este caché al terminar).
const CACHE_TTL_MS = 60_000;

router.get("/", async (req, res) => {
  const data = await cache
    .getOrSet("selectUsers", CACHE_TTL_MS, async () => {
      const [usuarios, roles] = await Promise.all([
        db.select("usuarios", {
          values:
            "id, nombre, apellido1, apellido2, correo_electronico, rol_id, activated",
          where: "",
          params: [],
        }),
        db.select("roles", {
          values: "*",
          where: "",
          params: [],
        }),
      ]);

      return { usuarios, roles };
    })
    .catch((err) => {
      console.error(err);
      res
        .status(400)
        .json({ msg: "Error al intentar seleccionar usuarios", error: err });
      throw new Error("Error al intentar seleccionar usuarios", err);
    });

  res.status(200).json(data);
});

module.exports = router;
