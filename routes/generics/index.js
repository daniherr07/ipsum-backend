const express = require("express");
const router = express.Router();
const db = require("../../lib/db");

router.get("/:table", async (req, res) => {
  const { table } = req.params;

  if (!table) {
    console.log(req.body);
    res.status(400).json({ msg: "Petición inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  console.log(table)

  const select = await db
    .select(table, {
      values: "*",
      where: "",
      params: [],
    })
    .catch((err) => {
      res.status(400).json({
        msg: "No se pudo conseguir la información de esa tabla",
        error: err,
      });
      throw new Error("No se pudo conseguir la información de esa tabla", err);
    });

  return res.status(200).json(select);
});

module.exports = router;
