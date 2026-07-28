// Script operativo (no una ruta de la app): busca en la cuenta de Dropbox
// de Felipe (credenciales *_FELIPE en .env) las fotos de cédula de cada
// familiar que todavía no tenga una guardada en proyectos_families.id_link,
// y las liga en la base de datos.
//
// Por defecto corre en modo "dry run" (no escribe nada, ni en Dropbox ni en
// la BD): solo imprime qué asignaría. Para aplicar los cambios de verdad:
//
//   node scripts/matchCedulaPhotos.js --commit
//
// Los casos ambiguos (2+ familiares en el proyecto y el archivo no deja
// claro de quién es) NUNCA se asignan solos, ni siquiera en --commit: se
// listan aparte para decidirlos a mano.
require("dotenv").config();
const dropboxV2Api = require("dropbox-v2-api");
const db = require("../lib/db");

const COMMIT = process.argv.includes("--commit");

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

// Duplica a propósito la lógica de shared link de lib/addFileDropbox.js en
// vez de reutilizarla: ese archivo es parte del flujo de subida en
// producción y no quiero arriesgarlo por un script operativo de una vez.
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

// --- Emparejamiento de nombres --------------------------------------------

// Distancia de edición simple, para detectar variantes de una letra entre
// el nombre en la base de datos y el nombre escrito a mano en Dropbox
// (ej. "Yessenia" en el archivo vs "Yesenia" en la BD).
function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }

  return dp[a.length][b.length];
}

// Palabras "casi iguales": mismo largo aproximado y a lo sumo 1 letra de
// diferencia cada 6 caracteres (una palabra de 12 letras admite 2 de
// diferencia, una de 6 o menos solo admite 1).
function fuzzyEquals(a, b) {
  if (a === b) return true;
  const maxDistance = Math.max(1, Math.floor(Math.max(a.length, b.length) / 6));
  return levenshtein(a, b) <= maxDistance;
}

function normalize(text) {
  return (text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos (marcas diacríticas combinantes tras normalize("NFD"))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const TIPO_MIEMBRO_KEYWORDS = {
  hijo: ["hijo", "hija"],
  conyuge: ["conyuge", "esposo", "esposa"],
  jefe: ["jefe"],
  madre: ["madre", "mama"],
  padre: ["padre", "papa"],
};

function tipoMiembroKeywords(tipoMiembro) {
  const norm = normalize(tipoMiembro);
  return Object.values(TIPO_MIEMBRO_KEYWORDS).find((keywords) =>
    keywords.some((k) => norm.includes(k)),
  ) || [];
}

// Palabras que indican que el documento es de un TERCERO ajeno al núcleo
// familiar (quien vende o es dueño del lote, no necesariamente alguien del
// proyecto) — nunca se considera candidato, ni siquiera como "genérico".
const THIRD_PARTY_KEYWORDS = ["vendedor", "vendedora", "propietari", "comprador", "compradora"];

// id_route no está poblado en los registros existentes (solo id_link, la
// URL del shared link de Dropbox), así que para saber si un archivo YA
// está en uso hay que sacar el nombre de archivo de la URL y compararlo
// normalizado. Sin esto, un archivo que ya es la foto de alguien (aunque
// mal nombrado, ej. "cedula-de-ella.pdf") se podía volver a asignar a otro
// familiar del mismo proyecto.
function filenameFromLink(link) {
  if (!link) return null;
  const withoutQuery = link.split("?")[0];
  const lastSegment = withoutQuery.split("/").pop();
  return normalize(decodeURIComponent(lastSegment || ""));
}

function isCedulaFile(entry) {
  const normPath = normalize(entry.path_display);
  if (!normPath.includes("cedula")) return false;
  return !THIRD_PARTY_KEYWORDS.some((k) => normPath.includes(k));
}

// A cuáles miembros (de la lista dada) el nombre del archivo parece
// corresponder. En vez de exigir que TODOS los apellidos aparezcan en el
// archivo (muchos archivos solo usan el primer nombre, ej. "Cedula
// Evelyn.pdf"), se cuenta cuántas palabras del nombre completo aparecen en
// el archivo y se queda con quien(es) tengan más coincidencias. Si nadie
// tiene ninguna coincidencia de nombre, se cae a un respaldo por tipo de
// miembro (hijo/a, cónyuge, etc.).
function membersMatchingFile(file, members) {
  const normFile = normalize(file.name);
  const fileTokens = [...new Set(normFile.split(" ").filter((t) => t.length > 2))];

  const scored = members
    .map((member) => {
      const nameTokens = normalize(`${member.nombre} ${member.apellido1} ${member.apellido2 || ""}`)
        .split(" ")
        .filter((t) => t.length > 2);
      const overlap = nameTokens.filter((nameToken) =>
        fileTokens.some((fileToken) => fuzzyEquals(nameToken, fileToken)),
      ).length;
      return { member, overlap };
    })
    .filter((s) => s.overlap > 0);

  if (scored.length > 0) {
    const maxOverlap = Math.max(...scored.map((s) => s.overlap));
    return scored.filter((s) => s.overlap === maxOverlap).map((s) => s.member);
  }

  // Respaldo: nadie coincide por nombre, probar por tipo de miembro.
  return members.filter((member) =>
    tipoMiembroKeywords(member.tipo_miembro).some((k) => normFile.includes(k)),
  );
}

// --- Programa principal ---------------------------------------------------

async function main() {
  const token = await getFelipeAccessToken();
  const dropbox = dropboxV2Api.authenticate({ token });

  const rootEntries = await listFolder(dropbox, "", false);
  const rootFolders = rootEntries.filter((e) => e[".tag"] === "folder");

  const projects = await db.query(`
    SELECT p.id, p.nombre
    FROM proyectos_new p
    WHERE EXISTS (
      SELECT 1 FROM proyectos_families f
      WHERE f.proyecto_id = p.id AND (f.id_link IS NULL OR f.id_link = '')
    )
  `);

  console.log(`Modo: ${COMMIT ? "COMMIT (se va a escribir)" : "DRY RUN (solo reporte)"}`);
  console.log(`Proyectos con familiares sin foto: ${projects.length}\n`);

  let confirmedCount = 0;
  let ambiguousCount = 0;
  let noFolderCount = 0;

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

    // Se trae el roster COMPLETO (no solo quienes faltan): un archivo con
    // nombre propio puede pertenecer a alguien que YA tiene foto, y no hay
    // que quitárselo para dárselo por error a quien todavía le falta.
    const allMembers = await db.query(
      "SELECT db_id, id, nombre, apellido1, apellido2, tipo_miembro, id_link FROM proyectos_families WHERE proyecto_id = ?",
      [project.id],
    );
    const membersNeedingPhoto = allMembers.filter((m) => !m.id_link);

    // Nombres de archivo que ya están en uso como foto de alguien en este
    // proyecto (aunque el nombre del archivo no coincida con esa persona,
    // como "cedula-de-ella.pdf"): nunca se vuelven a asignar a otro familiar.
    const usedFilenames = new Set(
      allMembers.map((m) => filenameFromLink(m.id_link)).filter(Boolean),
    );

    const allEntries = await listFolder(dropbox, folder.path_lower, true);
    const candidateFiles = allEntries
      .filter((e) => e[".tag"] === "file" && isCedulaFile(e))
      .filter((e) => !usedFilenames.has(normalize(e.name)));

    if (candidateFiles.length === 0) {
      console.log(`[SIN ARCHIVOS] Proyecto "${project.nombre}": ${membersNeedingPhoto.length} familiar(es) sin foto, ninguna cédula encontrada en Dropbox.`);
      continue;
    }

    const assignedIds = new Set();
    const genericFiles = []; // no calzan por nombre con NADIE del roster

    const assign = async (member, file, note = "") => {
      assignedIds.add(member.db_id);
      confirmedCount++;
      console.log(`[OK] "${project.nombre}" → ${member.nombre} ${member.apellido1} (${member.tipo_miembro}): ${file.path_display}${note}`);

      if (COMMIT) {
        const link = await getOrCreateSharedLink(dropbox, file.path_lower);
        const fileUrl = link.url.replace("www.dropbox.com", "dl.dropboxusercontent.com");
        await db.update(
          "proyectos_families",
          { id_link: fileUrl, id_route: file.path_display },
          "db_id = ?",
          [member.db_id],
        );
      }
    };

    // Paso 1: archivos que calzan por nombre/tipo con exactamente UNA
    // persona de TODO el roster. Si esa persona ya tiene foto, el archivo
    // queda "reclamado" por ella y no se toca para nadie más.
    for (const file of candidateFiles) {
      const matches = membersMatchingFile(file, allMembers);
      if (matches.length !== 1) continue;

      const member = matches[0];
      if (!membersNeedingPhoto.some((m) => m.db_id === member.db_id)) continue; // ya tiene foto, no se le asigna de nuevo
      if (assignedIds.has(member.db_id)) continue; // ya se le asignó otro archivo antes en este mismo proyecto

      await assign(member, file);
    }

    // Paso 2: archivos que no calzaron con nadie por nombre (genéricos:
    // "Cedula.jpg", UUID, etc.) — solo se asignan si sobra exactamente una
    // persona sin foto y exactamente un archivo genérico, sin ambigüedad.
    for (const file of candidateFiles) {
      const matches = membersMatchingFile(file, allMembers);
      if (matches.length === 0) genericFiles.push(file);
    }

    const stillNeeding = membersNeedingPhoto.filter((m) => !assignedIds.has(m.db_id));

    if (stillNeeding.length === 1 && genericFiles.length === 1) {
      await assign(stillNeeding[0], genericFiles[0], genericFiles.length > 1 ? "  [único candidato genérico]" : "");
    } else if (stillNeeding.length > 0 && genericFiles.length > 0) {
      ambiguousCount += genericFiles.length;
      const pending = stillNeeding.map((m) => `${m.nombre} ${m.apellido1} (${m.tipo_miembro})`).join(" | ");
      genericFiles.forEach((file) => {
        console.log(`[AMBIGUO] "${project.nombre}": ${file.path_display}  — familiares posibles: ${pending}`);
      });
    }
  }

  console.log("\n--- Resumen ---");
  console.log("Asignaciones confirmadas:", confirmedCount);
  console.log("Casos ambiguos (sin asignar):", ambiguousCount);
  console.log("Proyectos sin carpeta encontrada:", noFolderCount);

  process.exit(0);
}

main().catch((error) => {
  console.error("Error corriendo el script:", error);
  process.exit(1);
});
