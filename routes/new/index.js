const express = require("express");
const router = express.Router();
const db = require("../../lib/db");
const initializeDropbox = require("../../lib/dropbox");
const cache = require("../../lib/cache");
const sendEmail = require("../../lib/sendEmail");
const { getAdminUsers } = require("../../lib/notificationRoles");
const { createNotifications } = require("../../lib/notifications");
const { buildEmailHtml, highlightBox } = require("../../lib/emailTemplate");

// Analista Magda: se le notifica todo proyecto nuevo sin importar a quién
// quede asignado (pedido explícitamente, no es una regla derivada de roles).
// Si ella cambia de puesto o sale de la empresa, hay que actualizar este id.
const ANALISTA_MAGDA_ID = 44;

router.post("/", async (req, res) => {
  if (!req.body) {
    console.log(req.body);
    res
      .status(400)
      .json({ msg: "Nuevo proyecto inválido, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const { projectName, creatorUserId } = req.body;

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
      res.status(400).json({ msg: "Error al intentar insertar", error: err });
      // Debe relanzar: si el .catch() solo resuelve (sin throw), la cadena
      // .then() de abajo sigue ejecutándose con `response` = lo que devuelva
      // res.status().json() (no el insert), generando registros huérfanos
      // (proyecto_id undefined) y una segunda respuesta duplicada.
      throw new Error("Error al intentar insertar", err);
    })
    .then((response) => {
      intializeProject(response.insertId);
      createProjectFolders(
        projectName.toLowerCase().trim().replace(/\s+/g, "_"),
      );
      // El proyecto nuevo debe aparecer en /allProjects de inmediato, no
      // hasta que expire el TTL del caché.
      cache.delete("allProjects");
      // Sin await, igual que intializeProject/createProjectFolders arriba:
      // no debe demorar la respuesta al usuario.
      notifyNewProject(response.insertId, projectName, creatorUserId);
      return res.status(200).json({ projectId: response.insertId });
    });
});

async function notifyNewProject(projectId, projectName, creatorUserId) {
  try {
    const [magdaRows, adminUsers] = await Promise.all([
      db.select("usuarios", {
        values: "id, correo_electronico",
        where: "id = ? and activated = 1",
        params: [ANALISTA_MAGDA_ID],
      }),
      getAdminUsers(),
    ]);

    const recipients = [...magdaRows, ...adminUsers];
    const emails = recipients.map((row) => row.correo_electronico).filter(Boolean);

    await Promise.all([
      sendEmail({
        to: emails,
        // Asunto concreto: nombra el proyecto directamente, no solo "nuevo
        // proyecto" genérico.
        subject: `Proyecto creado: ${projectName}`,
        html: buildEmailHtml({
          heading: "Nuevo proyecto",
          bodyHtml: `
            <p>Se creó un nuevo proyecto en el sistema.</p>
            ${highlightBox("Proyecto", projectName)}
          `,
        }),
      }),
      createNotifications(
        recipients.map((row) => ({
          usuario_id: row.id,
          proyecto_id: projectId,
          tipo: "proyecto_creado",
          titulo: "Nuevo proyecto",
          mensaje: `Se creó el proyecto "${projectName}".`,
          remitente_usuario_id: creatorUserId ?? null,
        })),
      ),
    ]);
  } catch (error) {
    console.error("Error enviando notificación de proyecto nuevo", error);
  }
}

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
