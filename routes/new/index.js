const express = require("express");
const router = express.Router();
const Sentry = require("@sentry/node");
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
  console.log(
    `[POST /new] creando proyecto "${projectName}" (creador: ${creatorUserId ?? "desconocido"})`,
  );

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
      const projectId = response.insertId;
      console.log(
        `[POST /new] fila creada en proyectos_new (id ${projectId}), inicializando tablas relacionadas...`,
      );

      // intializeProject/createProjectFolders/notifyNewProject corren sin
      // await (no deben demorar la respuesta al usuario), PERO deben tener
      // su propio .catch(): antes no lo tenían, así que si algo adentro
      // fallaba (ej. un insert que rechaza), quedaba como una promesa
      // rechazada sin atrapar en ningún lado ("unhandled rejection"). Node
      // mata el proceso completo por eso — no solo esta solicitud (que para
      // colmo ya recibió su 200 OK), sino TODAS las conexiones activas de
      // cualquier usuario en ese momento.
      intializeProject(projectId).catch((err) => {
        console.error(
          `[POST /new] no se pudo inicializar el proyecto ${projectId} (quedó revertido, ver logs de intializeProject)`,
          err,
        );
      });
      createProjectFolders(
        projectName.toLowerCase().trim().replace(/\s+/g, "_"),
      ).catch((err) => {
        console.error(
          `[POST /new] no se pudieron crear las carpetas de Dropbox para el proyecto ${projectId}`,
          err,
        );
      });
      // El proyecto nuevo debe aparecer en /allProjects de inmediato, no
      // hasta que expire el TTL del caché.
      cache.delete("allProjects");
      // notifyNewProject ya tiene su propio try/catch interno (no rechaza),
      // pero lo dejamos igual: si alguna vez cambia y empieza a rechazar,
      // no debe tumbar el proceso en silencio.
      notifyNewProject(projectId, projectName, creatorUserId).catch((err) => {
        console.error(
          `[POST /new] error inesperado notificando el proyecto nuevo ${projectId}`,
          err,
        );
      });
      return res.status(200).json({ projectId });
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
    Sentry.captureException(error, { extra: { proyectoId: projectId } });
  }
}

// Crea la fila inicial en cada una de las 5 tablas "compañeras" de un
// proyecto (proyectos_basics/locations/people/admins/stages). No hay
// soporte de transacciones SQL reales en lib/db.js (todo pasa por
// pool.execute, sin BEGIN/COMMIT), así que si un insert falla a mitad de
// camino, se revierte a mano borrando las tablas que sí se alcanzaron a
// crear y el proyecto mismo — antes NO se revertía nada, así que un
// proyecto podía quedar con, por ejemplo, proyectos_basics pero sin
// proyectos_people, y como insertPeople hace un UPDATE (no INSERT) sobre
// "proyecto_id = ?", esa sección del editor quedaba guardando en silencio
// para siempre (0 filas afectadas, sin error) sin que nadie se enterara.
async function intializeProject(projectId) {
  const tables = [
    "proyectos_basics",
    "proyectos_locations",
    "proyectos_people",
    "proyectos_admins",
    "proyectos_stages",
  ];

  const created = [];
  try {
    for (const table of tables) {
      await db.insert(table, { proyecto_id: projectId });
      created.push(table);
    }
    console.log(
      `[intializeProject] proyecto ${projectId} inicializado correctamente (${created.join(", ")})`,
    );
  } catch (err) {
    console.error(
      `[intializeProject] falló creando "${tables[created.length]}" para el proyecto ${projectId}; revirtiendo las ${created.length} tabla(s) ya creada(s) (${created.join(", ") || "ninguna"}) y el proyecto en sí`,
      err,
    );

    await Promise.all(
      created.map((table) =>
        db.delete(table, "proyecto_id = ?", [projectId]).catch((cleanupErr) => {
          console.error(
            `[intializeProject] no se pudo revertir ${table} del proyecto ${projectId} (puede quedar una fila huérfana, revisar a mano)`,
            cleanupErr,
          );
        }),
      ),
    );
    await db.delete("proyectos_new", "id = ?", [projectId]).catch((cleanupErr) => {
      console.error(
        `[intializeProject] no se pudo borrar el proyecto huérfano ${projectId} (revisar a mano en proyectos_new)`,
        cleanupErr,
      );
    });
    cache.delete("allProjects");

    throw err;
  }
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
