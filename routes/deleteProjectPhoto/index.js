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
  console.log(`[POST /deleteProjectPhoto] borrando foto de proyecto ${id}`);

  if (!id) {
    console.warn("[POST /deleteProjectPhoto] falta id en la petición");
    return res.status(400).json({ msg: "Faltan datos para borrar la imagen" });
  }

  try {
    if (img_route) await deleteFileDropbox(img_route);
  } catch (error) {
    // Si el archivo ya no existe en Dropbox (o falló por otra razón), se
    // sigue de todas formas para poder limpiar el registro en la base de
    // datos y no dejarlo huérfano apuntando a un archivo borrado.
    console.error(
      `[POST /deleteProjectPhoto] no se pudo borrar el archivo de Dropbox (foto ${id}, ruta ${img_route})`,
      error,
    );
  }

  const result = await db
    .delete("proyectos_photos", "id = ?", [id])
    .catch((err) => {
      console.error(
        `[POST /deleteProjectPhoto] no se pudo borrar la fila de la foto ${id}`,
        err,
      );
      res.status(400).json({ msg: "No se pudo borrar la imagen", error: err });
      throw new Error("No se pudo borrar la imagen", err);
    });

  console.log(`[POST /deleteProjectPhoto] foto ${id} borrada correctamente`);

  return res.status(200).json(result);
});

module.exports = router;
