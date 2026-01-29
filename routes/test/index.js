const express = require("express");
const router = express.Router();
const db = require("../../lib/db");
const hello = require('./helloworld')

router.get("/", async (req, res) => {
  const data = await db.select("usuarios");

  hello()

  return res.status(200).json({ data: data });
});

module.exports = router;
