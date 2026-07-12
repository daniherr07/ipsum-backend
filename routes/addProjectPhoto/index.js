const express = require("express");
const router = express.Router();
const db = require("../../lib/db");
const addFileDropbox = require("../../lib/addFileDropbox");

const multer = require("multer");

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/", upload.array("files"), async (req, res) => {
  try {
    const formData = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({
        message: "No se enviaron archivos",
      });
    }

    // allSettled en vez de all: si un archivo falla al subir a Dropbox, los
    // demás igual se guardan en vez de que uno solo tumbe el lote completo
    // (antes, un fallo a mitad de lote dejaba archivos ya subidos a Dropbox
    // huérfanos, sin fila en la BD y sin forma de saberlo desde la respuesta).
    const uploadResults = await Promise.allSettled(
      files.map((file) =>
        addFileDropbox(file, "project_photo", formData.path, "overview"),
      ),
    );

    const uploadedFiles = uploadResults
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
    const failedCount = uploadResults.length - uploadedFiles.length;

    const result = await Promise.all(
      uploadedFiles.map((fileData) =>
        db.insert("proyectos_photos", {
          proyecto_id: formData.proyecto_id,
          img_link: fileData.url,
          img_route: fileData.path,
        }),
      ),
    );

    return res.status(failedCount > 0 ? 207 : 200).json({
      message:
        failedCount > 0
          ? `${uploadedFiles.length} archivo(s) subidos, ${failedCount} fallaron`
          : "Archivos subidos correctamente",
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
