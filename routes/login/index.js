const express = require("express");
const router = express.Router();
const db = require("../../lib/db");
const bcrypt = require("bcrypt");

//const saltRounds = 10;

router.post("/", async (req, res) => {
  if (!req.body) {
    console.log(req.body);
    res
      .status(400)
      .json({ msg: "Petición de login inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const { username, password } = req.body;

  const userSelect = await db.select("usuarios", {
    values: "*",
    where: "nombre = ? or correo_electronico = ?",
    params: [username, username],
  });

  if (!userSelect || userSelect.length == 0) {
    throw new Error("El usuario no existe");
  }

  bcrypt.compare(password, userSelect[0].password, (err, isMatch) => {
    if (err) {
      console.log("error");
      throw new Error("Couldn't compare passwords");
    }
    if (isMatch) {
      return res.status(200).json(userSelect[0]);
    } else {
      return res.status(400).json({ msg: "User not found" });
    }
  });
});

module.exports = router;
