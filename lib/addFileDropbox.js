const initializeDropbox = require("./dropbox");
const { Readable } = require("stream");
const Sentry = require("@sentry/node");

async function addFileDropbox(file, fileName, slug, folder) {
  const dropbox = await initializeDropbox();
  try {
    const stream = Readable.from(file.buffer);

    const originalName = file.originalname;
    const extension = originalName.substring(originalName.lastIndexOf(".")); // ".jpg"

    const filePath = `/${slug}/${folder}/${fileName}_${Date.now()}${extension}`;

    await new Promise((resolve, reject) => {
      dropbox(
        {
          resource: "files/upload",
          parameters: {
            path: filePath,
            mode: "add",
            autorename: true,
          },
          readStream: stream,
        },
        (err, result) => {
          if (err) {
            console.error("Dropbox upload error:", err);
            return reject(err);
          }
          resolve(result);
        },
      );
    });

    let sharedLinkResponse;
    try {
      // Try to create a new shared link
      sharedLinkResponse = await new Promise((resolve, reject) => {
        dropbox(
          {
            resource: "sharing/create_shared_link_with_settings",
            parameters: {
              path: filePath,
              settings: {
                requested_visibility: "public",
              },
            },
          },
          (err, result) => {
            if (err) {
              return reject(err);
            }
            resolve(result);
          },
        );
      });
    } catch (error) {
      console.log(error);
      // If the shared link already exists, get the existing one
      if (error.error && error.error[".tag"] === "shared_link_already_exists") {
        sharedLinkResponse = await new Promise((resolve, reject) => {
          dropbox(
            {
              resource: "sharing/list_shared_links",
              parameters: {
                path: filePath,
                direct_only: true,
              },
            },
            (err, result) => {
              if (err) {
                console.error("Error getting existing shared link:", err);
                return reject(err);
              }
              if (result.links && result.links.length > 0) {
                resolve(result.links[0]);
              } else {
                reject(new Error("No existing shared link found"));
              }
            },
          );
        });
      } else {
        // If it's a different error, throw it
        throw error;
      }
    }

    const fileUrl = sharedLinkResponse.url.replace(
      "www.dropbox.com",
      "dl.dropboxusercontent.com",
    );

    return {
      url: fileUrl,
      path: filePath,
    };
  } catch (error) {
    console.error("Error al intentar subir archivo", error);
    // Se captura acá (punto único para las 3 rutas que suben archivos:
    // insertMemberFile, addLocationImage, addProjectPhoto) para que quede
    // en Sentry sin importar si quien llama termina tragándose el error
    // (ej. Promise.allSettled en addLocationImage/addProjectPhoto). Sin
    // datos del archivo (nombre/contenido), solo slug/folder para ubicar
    // el caso.
    Sentry.captureException(error, { extra: { slug, folder } });
    // Antes se tragaba el error y devolvía undefined: quien llamaba no podía
    // distinguir éxito de fracaso (ej. insertMemberFile guardaba id_link:
    // null y respondía 200 igual, como si la subida hubiera funcionado).
    throw error;
  }
}

module.exports = addFileDropbox;
