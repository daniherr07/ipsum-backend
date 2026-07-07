const express = require("express");
const router = express.Router();
const db = require("../../lib/db");
const addFileDropbox = require("../../lib/addFileDropbox");

const multer = require("multer");

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/", upload.array("files"), async (req, res) => {
  try {

    console.log("entro aqui")
    const formData = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({
        message: "No se enviaron archivos",
      });
    }

    console.log("entro aqui 2");

    // 🔥 Subir todos los archivos en paralelo
    const uploadedFiles = await Promise.all(
      files.map((file) =>
        addFileDropbox(file, "project_photo", formData.path, "overview"),
      ),
    );

    console.log("entro aqui 3");

    // 🔥 Preparar inserts para la DB
    const inserts = uploadedFiles.map((fileData) =>
      db.insert("proyectos_photos", {
        proyecto_id: formData.proyecto_id,
        img_link: fileData.url,
        img_route: fileData.path,
      }),
    );

    console.log("entro aqui 4");

    const result = await Promise.all(inserts);

    return res.status(200).json({
      message: "Archivos subidos correctamente",
      files: result,
    });
  } catch (error) {
    console.error("Error subiendo archivos:", error);

    return res.status(500).json({
      message: "Error al subir archivos",
    });
  }
});

module.exports = router;
