const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();

app.use(cors());
app.use(express.json());

/** Middleware para detección de errores */
app.use((err, req, res) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

app.use("/", require("./routes"));

console.log("Connection pool created!");

module.exports = app;
