const initializeDropbox = require("./dropbox");

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
          return reject(err);
        }
        resolve(result);
      },
    );
  });
}

module.exports = deleteFileDropbox;
