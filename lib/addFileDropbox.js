const initializeDropbox = require("./dropbox");
const { Readable } = require("stream");

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
    console.error("Error al intentar subir archivo" + error);
  }
}

module.exports = addFileDropbox;
