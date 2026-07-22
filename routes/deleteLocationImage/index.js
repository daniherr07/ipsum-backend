const express = require("express");
const router = express.Router();
const db = require("../../lib/db");
const deleteFileDropbox = require("../../lib/deleteFileDropbox");

router.post("/", async (req, res) => {
  if (!req.body) {
    res.status(400).json({ msg: "Petición inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const { proyecto_id, img_route } = req.body;
  console.log(
    `[POST /deleteLocationImage] borrando imagen de ubicación (proyecto ${proyecto_id}, ruta ${img_route})`,
  );

  if (!proyecto_id || !img_route) {
    console.warn(
      "[POST /deleteLocationImage] faltan proyecto_id/img_route en la petición",
    );
    return res
      .status(400)
      .json({ msg: "Faltan datos para borrar la imagen" });
  }

  try {
    await deleteFileDropbox(img_route);
  } catch (error) {
    // Si el archivo ya no existe en Dropbox (o falló por otra razón), se
    // sigue de todas formas para poder limpiar el registro en la base de
    // datos y no dejarlo huérfano apuntando a un archivo borrado.
    console.error(
      `[POST /deleteLocationImage] no se pudo borrar el archivo de Dropbox (proyecto ${proyecto_id}, ruta ${img_route})`,
      error,
    );
  }

  // proyectos_locations_img no tiene una llave primaria propia; se borra
  // por proyecto_id + img_route, que es único por archivo (el path incluye
  // un timestamp, ver lib/addFileDropbox.js).
  const result = await db
    .delete("proyectos_locations_img", "proyecto_id = ? and img_route = ?", [
      proyecto_id,
      img_route,
    ])
    .catch((err) => {
      console.error(
        `[POST /deleteLocationImage] no se pudo borrar la fila de la imagen (proyecto ${proyecto_id}, ruta ${img_route})`,
        err,
      );
      res.status(400).json({ msg: "No se pudo borrar la imagen", error: err });
      throw new Error("No se pudo borrar la imagen", err);
    });

  console.log(
    `[POST /deleteLocationImage] imagen borrada correctamente (proyecto ${proyecto_id}, ruta ${img_route})`,
  );

  return res.status(200).json(result);
});

module.exports = router;
