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

  let fileData = null;

  if (req.file) {
    // Subir a Dropbox usando tu función
    fileData = await addFileDropbox(
      req.file,
      formData.id,
      formData.path,
      "families",
    );
  }

  // Guardar todo en la DB
  const memberUpdate = await db.update(
    "proyectos_families",
    {
      id_link: fileData ? fileData.url : null,
      id_route: fileData ? fileData.path : null,
    },
    "id = ? and proyecto_id = ?",
    [formData.id, formData.proyecto_id],
  );

  return res.status(200).json(memberUpdate);
});

module.exports = router;
