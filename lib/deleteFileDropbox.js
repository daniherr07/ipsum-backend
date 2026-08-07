const initializeDropbox = require("./dropbox");
const Sentry = require("@sentry/node");

// Borra un archivo de Dropbox dado su path completo (el mismo que se
// guarda en la columna img_route al subirlo con addFileDropbox).
async function deleteFileDropbox(path) {
  const dropbox = await initializeDropbox();

  return new Promise((resolve, reject) => {
    dropbox(
      {
        resource: "files/delete_v2",
        parameters: { path },
      },
      (err, result) => {
        if (err) {
          console.error("Dropbox delete error:", err);
          // Los 3 llamadores (deleteLocationImage, deleteMemberPhoto,
          // deleteProjectPhoto) tragan este error a propósito (para poder
          // limpiar la fila en la BD aunque Dropbox falle) — se captura acá
          // para que ese fallo intencional no quede invisible para Sentry.
          Sentry.captureException(err, { extra: { path } });
          return reject(err);
        }
        resolve(result);
      },
    );
  });
}

module.exports = deleteFileDropbox;
