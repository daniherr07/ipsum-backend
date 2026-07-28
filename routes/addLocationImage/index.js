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
    console.log(
      `[POST /addLocationImage] subiendo ${files ? files.length : 0} imagen(es) de ubicación (proyecto ${formData.proyecto_id})`,
    );

    if (!files || files.length === 0) {
      console.warn(
        `[POST /addLocationImage] petición sin archivos (proyecto ${formData.proyecto_id})`,
      );
      return res.status(400).json({
        message: "No se enviaron archivos",
      });
    }

    // allSettled: si una imagen falla al subir a Dropbox, las demás igual se
    // guardan en vez de que una sola tumbe el lote completo (ver mismo fix
    // en routes/addProjectPhoto).
    const uploadResults = await Promise.allSettled(
      files.map((file) =>
        addFileDropbox(file, "location_photo", formData.path, "locations"),
      ),
    );

    const uploadedFiles = uploadResults
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
    const failedCount = uploadResults.length - uploadedFiles.length;

    const result = await Promise.all(
      uploadedFiles.map((fileData) =>
        db.insert("proyectos_locations_img", {
          proyecto_id: formData.proyecto_id,
          img_link: fileData.url,
          img_route: fileData.path,
        }),
      ),
    );

    if (failedCount > 0) {
      console.warn(
        `[POST /addLocationImage] ${failedCount} de ${uploadResults.length} imagen(es) fallaron al subir (proyecto ${formData.proyecto_id})`,
      );
    } else {
      console.log(
        `[POST /addLocationImage] ${uploadedFiles.length} imagen(es) guardadas correctamente (proyecto ${formData.proyecto_id})`,
      );
    }

    return res.status(failedCount > 0 ? 207 : 200).json({
      message:
        failedCount > 0
          ? `${uploadedFiles.length} imagen(es) subidas, ${failedCount} fallaron`
          : "Imágenes de ubicación subidas correctamente",
      files: result,
    });
  } catch (error) {
    console.error(
      `[POST /addLocationImage] error inesperado subiendo imágenes de ubicación (proyecto ${req.body?.proyecto_id})`,
      error,
    );

    return res.status(500).json({
      message: "Error al subir imágenes",
    });
  }
});

module.exports = router;
