const express = require("express");
const router = express.Router();
const db = require("../../lib/db");
const deleteFileDropbox = require("../../lib/deleteFileDropbox");

router.post("/", async (req, res) => {
  if (!req.body) {
    res.status(400).json({ msg: "Petición inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const { id, img_route } = req.body;

  if (!id) {
    return res.status(400).json({ msg: "Faltan datos para borrar la imagen" });
  }

  try {
    if (img_route) await deleteFileDropbox(img_route);
  } catch (error) {
    // Si el archivo ya no existe en Dropbox (o falló por otra razón), se
    // sigue de todas formas para poder limpiar el registro en la base de
    // datos y no dejarlo huérfano apuntando a un archivo borrado.
    console.error("Error borrando archivo de Dropbox", error);
  }

  const result = await db
    .delete("proyectos_photos", "id = ?", [id])
    .catch((err) => {
      res.status(400).json({ msg: "No se pudo borrar la imagen", error: err });
      throw new Error("No se pudo borrar la imagen", err);
    });

  return res.status(200).json(result);
});

module.exports = router;
