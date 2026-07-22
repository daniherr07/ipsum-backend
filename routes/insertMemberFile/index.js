const express = require("express");
const router = express.Router();
const db = require("../../lib/db");
const addFileDropbox = require("../../lib/addFileDropbox");

const multer = require("multer");

// Configuración de Multer para guardar en memoria (puedes cambiar a disco si quieres)
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/", upload.single("file"), async (req, res) => {
  const formData = req.body;
  console.log(
    `[POST /insertMemberFile] subiendo foto de cédula (proyecto ${formData?.proyecto_id}, miembro ${formData?.id})`,
  );

  if (!formData || !formData.id || !formData.proyecto_id) {
    console.warn(
      "[POST /insertMemberFile] faltan datos (id/proyecto_id) en la petición",
    );
    return res.status(400).json({ msg: "Faltan datos para subir la foto" });
  }

  let fileData = null;

  if (req.file) {
    try {
      fileData = await addFileDropbox(
        req.file,
        formData.id,
        formData.path,
        "families",
      );
    } catch (error) {
      console.error(
        `[POST /insertMemberFile] no se pudo subir la foto de cédula a Dropbox (proyecto ${formData.proyecto_id}, miembro ${formData.id})`,
        error,
      );
      return res.status(500).json({ msg: "No se pudo subir la foto" });
    }
  }

  const memberUpdate = await db
    .update(
      "proyectos_families",
      {
        id_link: fileData ? fileData.url : null,
        id_route: fileData ? fileData.path : null,
      },
      "id = ? and proyecto_id = ?",
      [formData.id, formData.proyecto_id],
    )
    .catch((err) => {
      console.error(
        `[POST /insertMemberFile] no se pudo guardar la foto (proyecto ${formData.proyecto_id}, miembro ${formData.id})`,
        err,
      );
      res.status(400).json({ msg: "No se pudo guardar la foto", error: err });
      throw new Error("No se pudo guardar la foto", err);
    });

  console.log(
    `[POST /insertMemberFile] foto guardada correctamente (proyecto ${formData.proyecto_id}, miembro ${formData.id})`,
  );

  return res.status(200).json(memberUpdate);
});

module.exports = router;
