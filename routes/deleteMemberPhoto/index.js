const express = require("express");
const router = express.Router();
const db = require("../../lib/db");
const deleteFileDropbox = require("../../lib/deleteFileDropbox");

// Borra la foto de cédula de un familiar (no borra al familiar): limpia
// id_link/id_route en proyectos_families, igual que /insertMemberFile deja
// esos campos si no se sube una foto nueva, pero además borra el archivo
// real en Dropbox (ver /deleteProjectPhoto, mismo patrón).
router.post("/", async (req, res) => {
  if (!req.body) {
    res.status(400).json({ msg: "Petición inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const { db_id, img_route } = req.body;
  console.log(`[POST /deleteMemberPhoto] borrando foto de cédula (miembro db_id ${db_id})`);

  if (!db_id) {
    console.warn("[POST /deleteMemberPhoto] falta db_id en la petición");
    return res.status(400).json({ msg: "Faltan datos para borrar la imagen" });
  }

  try {
    if (img_route) await deleteFileDropbox(img_route);
  } catch (error) {
    // Si el archivo ya no existe en Dropbox (o falló por otra razón), se
    // sigue de todas formas para poder limpiar el registro en la base de
    // datos y no dejarlo apuntando a un archivo borrado/inexistente.
    console.error(
      `[POST /deleteMemberPhoto] no se pudo borrar el archivo de Dropbox (miembro db_id ${db_id}, ruta ${img_route})`,
      error,
    );
  }

  const result = await db
    .update(
      "proyectos_families",
      { id_link: null, id_route: null },
      "db_id = ?",
      [db_id],
    )
    .catch((err) => {
      console.error(
        `[POST /deleteMemberPhoto] no se pudo limpiar la foto del miembro db_id ${db_id}`,
        err,
      );
      res.status(400).json({ msg: "No se pudo borrar la imagen", error: err });
      throw new Error("No se pudo borrar la imagen", err);
    });

  console.log(`[POST /deleteMemberPhoto] foto de cédula borrada correctamente (miembro db_id ${db_id})`);

  return res.status(200).json(result);
});

module.exports = router;
