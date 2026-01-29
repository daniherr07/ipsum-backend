const express = require("express");
const router = express.Router();
const db = require("../../lib/db");

router.get("/", async (req, res) => {
  const userSelect = await db
    .select("usuarios", {
      values:
        "id, nombre, apellido1, apellido2, correo_electronico, rol_id, activated",
      where: "",
      params: [],
    })
    .catch((err) => {
      console.error(err);
      return res
        .status(400)
        .json({ msg: "Error al intentar seleccionar usuarios" + err });
    });

  const rolesSelect = await db
    .select("roles", {
      values: "*",
      where: "",
      params: [],
    })
    .catch((err) => {
      console.error(err);
      return res
        .status(400)
        .json({ msg: "Error al intentar seleccionar roles" + err });
    });

  res.status(200).json({usuarios: userSelect, roles: rolesSelect})
});

module.exports = router;
