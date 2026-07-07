const express = require("express");
const router = express.Router();
const db = require("../../lib/db");
const initializeDropbox = require("../../lib/dropbox");

router.post("/", async (req, res) => {
  if (!req.body) {
    console.log(req.body);
    res
      .status(400)
      .json({ msg: "Nuevo proyecto inválido, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const { projectName } = req.body;

  const date = new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const formattedDate = `${parts.find((p) => p.type === "year").value}-${
    parts.find((p) => p.type === "month").value
  }-${parts.find((p) => p.type === "day").value}`;

  await db
    .insert("proyectos_new", {
      nombre: projectName,
      slug: projectName.toLowerCase().trim().replace(/\s+/g, "_"),
      activo: true,
      created_at: formattedDate,
    })
    .catch((err) => {
      console.error(err);
      return res
        .status(400)
        .json({ msg: "Error al intentar insertar", error: err });
    })
    .then((response) => {
      intializeProject(response.insertId);
      createProjectFolders(
        projectName.toLowerCase().trim().replace(/\s+/g, "_"),
      );
      return res.status(200).json({ projectId: response.insertId });
    });
});

async function intializeProject(projectId) {
  await db
    .insert("proyectos_basics", {
      proyecto_id: projectId,
    })
    .catch((err) => {
      console.error(err);
      throw new Error("Couldn't initialize basics", err);
    });

  await db
    .insert("proyectos_locations", {
      proyecto_id: projectId,
    })
    .catch((err) => {
      console.error(err);
      throw new Error("Couldn't initialize basics");
    });

  await db
    .insert("proyectos_people", {
      proyecto_id: projectId,
    })
    .catch((err) => {
      console.err(err);
      throw new Error("Couldn't initialize basics");
    });

  await db
    .insert("proyectos_admins", {
      proyecto_id: projectId,
    })
    .catch((err) => {
      console.err(err);
      throw new Error("Couldn't initialize basics");
    });

  await db
    .insert("proyectos_stages", {
      proyecto_id: projectId,
    })
    .catch((err) => {
      console.error(err);
      throw new Error("Couldn't initialize basics");
    });
}

async function createFolder(path) {
  const dropbox = await initializeDropbox();
  return new Promise((resolve, reject) => {
    dropbox(
      {
        resource: "files/create_folder_v2",
        parameters: {
          path,
          autorename: true,
        },
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      },
    );
  });
}

async function createProjectFolders(slug) {
  try {
    // 1️⃣ Carpeta principal
    const root = await createFolder(`/${slug}`);

    // Usar la ruta REAL (por si autorename cambió el nombre)
    const basePath = root.metadata.path_lower;

    // 2️⃣ Subcarpetas (una por una)
    await createFolder(`${basePath}/families`);
    await createFolder(`${basePath}/locations`);
    await createFolder(`${basePath}/overview`);

    return true;
  } catch (error) {
    console.error("Error creando folders en Dropbox", error);
    throw error;
  }
}

module.exports = router;
