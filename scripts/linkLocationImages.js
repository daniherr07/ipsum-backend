// Script operativo (no una ruta de la app): busca en la cuenta de Dropbox de
// Felipe (credenciales *_FELIPE en .env) las fotos dentro de la subcarpeta
// "Catastros" de cada proyecto (fotos/planos del lote) y las liga en
// proyectos_locations_img (pestaña "Ubicación" del editor de proyecto).
//
// Por defecto corre en modo "dry run" (no escribe nada, ni en Dropbox ni en
// la BD): solo imprime qué insertaría. Para aplicar los cambios de verdad:
//
//   node scripts/linkLocationImages.js --commit
//
// Es seguro correrlo más de una vez: antes de insertar, revisa qué
// img_route ya existen para el proyecto y no los vuelve a insertar.
require("dotenv").config();
const dropboxV2Api = require("dropbox-v2-api");
const db = require("../lib/db");

const COMMIT = process.argv.includes("--commit");

const SOURCE_SUBFOLDER_RAW = "Catastros";
const TARGET_TABLE = "proyectos_locations_img";
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp", ".gif"];

// --- Dropbox (cuenta de Felipe) ------------------------------------------

async function getFelipeAccessToken() {
  const response = await fetch("https://api.dropbox.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: process.env.DROPBOX_REFRESH_TOKEN_FELIPE,
      grant_type: "refresh_token",
      client_id: process.env.DROPBOX_CLIENT_ID_FELIPE,
      client_secret: process.env.DROPBOX_CLIENT_SECRET_FELIPE,
    }),
  });

  if (!response.ok) {
    throw new Error("No se pudo obtener el token de Dropbox de Felipe: " + JSON.stringify(await response.json()));
  }

  const data = await response.json();
  return data.access_token;
}

function listFolder(dropbox, path, recursive) {
  return new Promise((resolve, reject) => {
    dropbox(
      { resource: "files/list_folder", parameters: { path, recursive } },
      (err, result) => {
        if (err) return reject(err);
        resolve(result.entries);
      },
    );
  });
}

// Duplica a propósito la lógica de shared link de lib/addFileDropbox.js (ver
// scripts/matchCedulaPhotos.js): este es un script operativo de una vez y no
// quiero arriesgar el código del flujo de subida en producción.
function getOrCreateSharedLink(dropbox, path) {
  return new Promise((resolve, reject) => {
    dropbox(
      {
        resource: "sharing/create_shared_link_with_settings",
        parameters: { path, settings: { requested_visibility: "public" } },
      },
      (err, result) => {
        if (!err) return resolve(result);

        if (err.error && err.error[".tag"] === "shared_link_already_exists") {
          return dropbox(
            { resource: "sharing/list_shared_links", parameters: { path, direct_only: true } },
            (err2, result2) => {
              if (err2) return reject(err2);
              if (result2.links && result2.links.length > 0) return resolve(result2.links[0]);
              reject(new Error("No existing shared link found for " + path));
            },
          );
        }

        reject(err);
      },
    );
  });
}

function normalize(text) {
  return (text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos (marcas diacríticas combinantes tras normalize("NFD"))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isImageFile(entry) {
  const ext = entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

function isInSubfolder(entry, folderPathLower, subfolderNameRaw) {
  const relative = entry.path_lower.slice(folderPathLower.length + 1);
  const firstSegment = relative.split("/")[0];
  return normalize(firstSegment) === normalize(subfolderNameRaw);
}

// --- Programa principal ---------------------------------------------------

async function main() {
  const token = await getFelipeAccessToken();
  const dropbox = dropboxV2Api.authenticate({ token });

  const rootEntries = await listFolder(dropbox, "", false);
  const rootFolders = rootEntries.filter((e) => e[".tag"] === "folder");

  const projects = await db.query("SELECT id, nombre FROM proyectos_new");

  console.log(`Modo: ${COMMIT ? "COMMIT (se va a escribir)" : "DRY RUN (solo reporte)"}`);
  console.log(`Proyectos en la base de datos: ${projects.length}\n`);

  let insertedCount = 0;
  let skippedExistingCount = 0;
  let noFolderCount = 0;
  let noPhotosCount = 0;

  for (const project of projects) {
    const expectedFolderName = project.nombre.replace(/ /g, "_");

    const folder =
      rootFolders.find((f) => f.name === expectedFolderName) ||
      rootFolders.find((f) => normalize(f.name) === normalize(expectedFolderName));

    if (!folder) {
      noFolderCount++;
      console.log(`[SIN CARPETA] Proyecto "${project.nombre}" (id ${project.id}): no encontré una carpeta correspondiente en Dropbox.`);
      continue;
    }

    const allEntries = await listFolder(dropbox, folder.path_lower, true);
    const photoFiles = allEntries.filter(
      (e) => e[".tag"] === "file" && isImageFile(e) && isInSubfolder(e, folder.path_lower, SOURCE_SUBFOLDER_RAW),
    );

    if (photoFiles.length === 0) {
      noPhotosCount++;
      console.log(`[SIN FOTOS] Proyecto "${project.nombre}": no encontré imágenes en "Catastros".`);
      continue;
    }

    const existingRoutes = new Set(
      (await db.query(`SELECT img_route FROM ${TARGET_TABLE} WHERE proyecto_id = ?`, [project.id])).map(
        (r) => r.img_route,
      ),
    );

    for (const file of photoFiles) {
      if (existingRoutes.has(file.path_display)) {
        skippedExistingCount++;
        continue;
      }

      console.log(`[OK] "${project.nombre}": ${file.path_display}`);
      insertedCount++;

      if (COMMIT) {
        const link = await getOrCreateSharedLink(dropbox, file.path_lower);
        const fileUrl = link.url.replace("www.dropbox.com", "dl.dropboxusercontent.com");
        await db.insert(TARGET_TABLE, {
          proyecto_id: project.id,
          img_link: fileUrl,
          img_route: file.path_display,
        });
      }
    }
  }

  console.log("\n--- Resumen ---");
  console.log("Fotos insertadas:", insertedCount);
  console.log("Ya existían (omitidas):", skippedExistingCount);
  console.log("Proyectos sin carpeta encontrada:", noFolderCount);
  console.log("Proyectos sin fotos en Catastros:", noPhotosCount);

  process.exit(0);
}

main().catch((error) => {
  console.error("Error corriendo el script:", error);
  process.exit(1);
});
