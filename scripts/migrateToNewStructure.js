// Script operativo (no una ruta de la app): reconstruye una base de datos
// nueva a partir de un dump viejo (estructura + datos) y el esquema nuevo
// (solo estructura), igual que la migración pasada de "legacy" a
// "proyectos_new".
//
// IMPORTANTE (encontrado mientras se armaba este script, con datos reales):
// la tabla tmp_project_map de la migración anterior quedó DESACTUALIZADA —
// sus valores new_project_id (18, 19, 20...) ya no corresponden a ningún id
// real de proyectos_new hoy (que arranca en 60). proyectos_new debe haberse
// reconstruido en algún momento después de esa migración, esta vez
// preservando el MISMO id que su proyecto legado (old_id == new_id para las
// 136 filas, verificado por nombre). O sea: el bug de ids "cruzados" que
// parecía existir (bitácora/familias apuntando al proyecto equivocado) NO es
// real con los datos actuales — lo que sí sería un bug real es CONFIAR en
// tmp_project_map.new_project_id tal cual, que apuntaría todo a proyectos
// equivocados o inexistentes. Por eso este script NUNCA usa esa columna:
// recalcula el mapeo viejo→nuevo de una vez por nombre (proyectos.nombre vs
// proyectos_new.nombre, sin mayúsculas/espacios) contra los datos de CADA
// corrida, y con eso vuelve a escribir tmp_project_map ya corregida.
//
// No toca "ipsumdb" ni ninguna base de producción: crea dos bases de trabajo
// propias (nombres configurables abajo) contra el MISMO servidor MySQL de
// .env (DB_HOST/DB_USER/DB_PASSWORD/DB_PORT):
//   - STAGING_DB: se borra y se recrea, y se le carga Old_StructureAndData.sql
//     tal cual (para poder leerlo con SQL en vez de parsear el archivo).
//   - TARGET_DB: la base nueva. En modo dry-run NO se toca. Con --commit se
//     borra, se recrea con New_StructureOnly.sql, y se llenan sus tablas.
//
// Uso:
//   node scripts/migrateToNewStructure.js            (dry run: solo reporta)
//   node scripts/migrateToNewStructure.js --commit    (arma la base de verdad)
//
// Requiere el cliente "mysql" en el PATH (el mismo que usa MySQL Workbench).

require("dotenv").config();
const { execFileSync } = require("child_process");
const mysql = require("mysql2/promise");
const path = require("path");
const fs = require("fs");

const COMMIT = process.argv.includes("--commit");

const REPO_ROOT = path.join(__dirname, "..", "..");
const OLD_DUMP_PATH = path.join(REPO_ROOT, "Old_StructureAndData.sql");
const NEW_SCHEMA_PATH = path.join(REPO_ROOT, "New_StructureOnly.sql");

const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = process.env.DB_PORT || "3306";
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "";

// Nombres de las bases de trabajo. Ninguno es "ipsumdb": son bases nuevas
// que este script crea/recrea desde cero cada vez que corre.
const STAGING_DB = process.env.MIGRATION_STAGING_DB || "ipsum_migration_source";
const TARGET_DB = process.env.MIGRATION_TARGET_DB || "ipsum_migrated";

// --- Tablas: cómo se trata cada una al pasar de STAGING a TARGET -----------

// Copiar tal cual (misma estructura en Old y New, sin ids que traducir).
const COPY_AS_IS_TABLES = [
  "analistas_entidades",
  "centros_negocios",
  "constructores",
  "entidades",
  "familias",
  "fiscales",
  "grupos_proyectos",
  "lotes",
  "promotores_ipsum",
  "propietarios",
  "proyectos_admins",
  "proyectos_basics",
  "proyectos_locations",
  "proyectos_locations_img",
  "proyectos_new",
  "proyectos_people",
  "proyectos_photos",
  "proyectos_stages",
  "tipos_bono",
  "tipos_propietario",
  "usuarios",
  "variantes_bono",
  // tmp_project_map NO se copia tal cual — ver computeFreshProjectMap() más
  // abajo: se recalcula por nombre y se reescribe con el mapeo correcto.
];

// Recalcula viejo→nuevo por nombre (TRIM+LOWER) entre proyectos (legado) y
// proyectos_new, en vez de confiar en tmp_project_map.new_project_id (que
// puede haber quedado desactualizada si proyectos_new se reconstruyó
// después de la migración pasada). Devuelve un Map de old_project_id a
// { newProjectId, oldName, newName }.
async function computeFreshProjectMap(conn) {
  const [rows] = await conn.query(`
    SELECT p.id as old_project_id, p.nombre as old_name, pn.id as new_project_id, pn.nombre as new_name
    FROM \`${STAGING_DB}\`.proyectos p
    JOIN \`${STAGING_DB}\`.proyectos_new pn
      ON TRIM(LOWER(CONVERT(p.nombre USING utf8mb4) COLLATE utf8mb4_unicode_ci))
       = TRIM(LOWER(CONVERT(pn.nombre USING utf8mb4) COLLATE utf8mb4_unicode_ci))
  `);

  const map = new Map();
  for (const r of rows) {
    map.set(r.old_project_id, { newProjectId: r.new_project_id, oldName: r.old_name, newName: r.new_name });
  }
  return map;
}

async function copyFreshProjectMap(conn, projectMap) {
  const entries = [...projectMap.entries()];

  if (COMMIT) {
    for (const [oldId, { newProjectId, oldName, newName }] of entries) {
      await conn.query(
        `INSERT INTO \`${TARGET_DB}\`.tmp_project_map (old_project_id, old_project_name, new_project_id, new_project_name) VALUES (?, ?, ?, ?)`,
        [oldId, oldName, newProjectId, newName],
      );
    }
  }

  const sameId = entries.filter(([oldId, { newProjectId }]) => oldId === newProjectId).length;
  log(
    "INFO",
    "REMAP",
    `tmp_project_map recalculada por nombre (no copiada de la fuente): ${entries.length} proyecto(s) emparejado(s), ${sameId} con el mismo id viejo=nuevo.`,
  );

  // Proyectos legado que no encontraron pareja por nombre en proyectos_new:
  // quedan registrados en tmp_orphan_projects (sus entradas_bitacora/
  // proyectos_families tampoco se van a poder traducir — ver esas funciones).
  const [unmatched] = await conn.query(`
    SELECT p.id as old_project_id, p.nombre as old_project_name
    FROM \`${STAGING_DB}\`.proyectos p
    WHERE p.id NOT IN (${entries.length > 0 ? entries.map(([oldId]) => oldId).join(",") : "-1"})
  `);

  if (COMMIT) {
    for (const r of unmatched) {
      await conn.query(
        `INSERT INTO \`${TARGET_DB}\`.tmp_orphan_projects (old_project_id, old_project_name, reason) VALUES (?, ?, ?)`,
        [r.old_project_id, r.old_project_name, "No se encontró (por nombre) un proyecto correspondiente en proyectos_new"],
      );
    }
  }

  if (unmatched.length > 0) {
    log("WARN", "REMAP", `${unmatched.length} proyecto(s) legado(s) no encontraron pareja por nombre en proyectos_new — ${COMMIT ? "movidos a tmp_orphan_projects" : "detectados"}; sus referencias en entradas_bitacora/proyectos_families no se podrán traducir.`);
  }
}

// --- Utilidades de conexión / shell -----------------------------------------

function runMysqlCli(databaseName, sqlFilePath) {
  const env = { ...process.env, MYSQL_PWD: DB_PASSWORD };
  const args = ["-h", DB_HOST, "-P", DB_PORT, "-u", DB_USER, databaseName];
  const sql = fs.readFileSync(sqlFilePath);
  execFileSync("mysql", args, { input: sql, env, stdio: ["pipe", "inherit", "inherit"] });
}

async function createConnection() {
  return mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true,
    // DATETIME no tiene zona horaria propia; mysql2 por defecto lo envuelve
    // en un objeto Date usando la hora local del proceso, y de ahí a
    // .toISOString() lo vuelve a convertir a UTC — sumando/restando horas
    // que nunca estuvieron ahí. dateStrings:true devuelve el valor tal cual
    // está guardado (un texto), sin pasar por ninguna conversión de por medio.
    dateStrings: true,
  });
}

async function recreateDatabase(conn, name) {
  await conn.query(`DROP DATABASE IF EXISTS \`${name}\``);
  await conn.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4`);
}

// --- Logging (se escribe en target.migration_log, igual que la vez pasada) -

const logBuffer = [];
function log(level, category, message) {
  console.log(`[${level}] ${category} — ${message}`);
  logBuffer.push({ level, category, message });
}

async function flushLogToTarget(conn) {
  for (const entry of logBuffer) {
    await conn.query(
      `INSERT INTO \`${TARGET_DB}\`.migration_log (level, category, message) VALUES (?, ?, ?)`,
      [entry.level, entry.category, entry.message],
    );
  }
}

// --- Paso 1: cargar el dump viejo en STAGING_DB -----------------------------

async function loadStaging(conn) {
  log("INFO", "SETUP", `Recreando base de staging "${STAGING_DB}" y cargando Old_StructureAndData.sql...`);
  await recreateDatabase(conn, STAGING_DB);
  runMysqlCli(STAGING_DB, OLD_DUMP_PATH);
  log("INFO", "SETUP", `Staging listo.`);
}

// --- Paso 2: crear TARGET_DB con el esquema nuevo (solo en --commit) -------

async function createTargetSchema(conn) {
  log("INFO", "SETUP", `Recreando base destino "${TARGET_DB}" y aplicando New_StructureOnly.sql...`);
  await recreateDatabase(conn, TARGET_DB);
  runMysqlCli(TARGET_DB, NEW_SCHEMA_PATH);
  log("INFO", "SETUP", `Esquema nuevo aplicado en destino.`);
}

// --- Paso 3: copiar tablas sin cambios --------------------------------------

async function copyAsIs(conn) {
  for (const table of COPY_AS_IS_TABLES) {
    const [countRows] = await conn.query(`SELECT COUNT(*) as c FROM \`${STAGING_DB}\`.\`${table}\``);
    const count = countRows[0].c;

    if (COMMIT) {
      await conn.query(
        `INSERT INTO \`${TARGET_DB}\`.\`${table}\` SELECT * FROM \`${STAGING_DB}\`.\`${table}\``,
      );
    }

    log("INFO", "COPY", `${table}: ${count} fila(s) ${COMMIT ? "copiada(s)" : "para copiar"}.`);
  }
}

// --- etapas: igual pero sin la columna "orden" ------------------------------

async function copyEtapas(conn) {
  const [rows] = await conn.query(`SELECT id, nombre, activated FROM \`${STAGING_DB}\`.etapas`);
  if (COMMIT) {
    for (const r of rows) {
      await conn.query(
        `INSERT INTO \`${TARGET_DB}\`.etapas (id, nombre, activated) VALUES (?, ?, ?)`,
        [r.id, r.nombre, r.activated],
      );
    }
  }
  log("INFO", "COPY", `etapas: ${rows.length} fila(s) ${COMMIT ? "copiada(s)" : "para copiar"} (se descarta la columna "orden", ya no existe en la estructura nueva).`);
}

// --- roles: igual pero sin la columna "color" -------------------------------

async function copyRoles(conn) {
  const [rows] = await conn.query(`SELECT id, nombre, descripcion FROM \`${STAGING_DB}\`.roles`);
  if (COMMIT) {
    for (const r of rows) {
      await conn.query(
        `INSERT INTO \`${TARGET_DB}\`.roles (id, nombre, descripcion) VALUES (?, ?, ?)`,
        [r.id, r.nombre, r.descripcion],
      );
    }
  }
  log("INFO", "COPY", `roles: ${rows.length} fila(s) ${COMMIT ? "copiada(s)" : "para copiar"} (se descarta la columna "color").`);
}

// --- proyectos (legado): igual pero sin etapa_actual_id/subetapa_actual_id --

async function copyProyectosLegacy(conn) {
  const [rows] = await conn.query(`
    SELECT id, nombre, descripcion, grupo_proyecto_id, tipo_bono_id, variante_bono_id,
           lote_id, fecha_ingreso, presupuesto, avaluo, estado_color, entidad_id,
           centro_negocio_id, analista_asigna_entidad_id, analista_asigna_ipsum_id,
           fiscal_id, ingeniero_id, arquitecto_id, promotor_interno_id, constructor_id,
           codigo_apc, codigo_cfia, fis, activated
    FROM \`${STAGING_DB}\`.proyectos
  `);

  if (COMMIT) {
    for (const r of rows) {
      await conn.query(
        `INSERT INTO \`${TARGET_DB}\`.proyectos
          (id, nombre, descripcion, grupo_proyecto_id, tipo_bono_id, variante_bono_id,
           lote_id, fecha_ingreso, presupuesto, avaluo, estado_color, entidad_id,
           centro_negocio_id, analista_asigna_entidad_id, analista_asigna_ipsum_id,
           fiscal_id, ingeniero_id, arquitecto_id, promotor_interno_id, constructor_id,
           codigo_apc, codigo_cfia, fis, activated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.id, r.nombre, r.descripcion, r.grupo_proyecto_id, r.tipo_bono_id, r.variante_bono_id,
          r.lote_id, r.fecha_ingreso, r.presupuesto, r.avaluo, r.estado_color, r.entidad_id,
          r.centro_negocio_id, r.analista_asigna_entidad_id, r.analista_asigna_ipsum_id,
          r.fiscal_id, r.ingeniero_id, r.arquitecto_id, r.promotor_interno_id, r.constructor_id,
          r.codigo_apc, r.codigo_cfia, r.fis, r.activated,
        ],
      );
    }
  }

  log("INFO", "COPY", `proyectos (legado): ${rows.length} fila(s) ${COMMIT ? "copiada(s)" : "para copiar"} (se descartan etapa_actual_id/subetapa_actual_id; subetapas ya no existe).`);
}

// --- entradas_bitacora: traduce proyecto_id + quita color + ajusta fecha ----

async function copyEntradasBitacora(conn, projectMap) {
  const [rows] = await conn.query(`
    SELECT eb.id, eb.proyecto_id as old_proyecto_id, eb.usuario_id, eb.descripcion,
           eb.fecha_ingreso, eb.tipo
    FROM \`${STAGING_DB}\`.entradas_bitacora eb
  `);

  let migrated = 0;
  let orphaned = 0;

  for (const r of rows) {
    const mapped = r.old_proyecto_id !== null ? projectMap.get(r.old_proyecto_id) : undefined;
    r.new_project_id = mapped ? mapped.newProjectId : null;

    if (r.old_proyecto_id !== null && r.new_project_id === null) {
      orphaned++;
      if (COMMIT) {
        await conn.query(
          `INSERT INTO \`${TARGET_DB}\`.tmp_orphan_bitacora (bitacora_id, old_project_id, reason) VALUES (?, ?, ?)`,
          [r.id, r.old_proyecto_id, "No se encontró (por nombre) un proyecto nuevo correspondiente a este proyecto viejo"],
        );
      }
      continue;
    }

    migrated++;
    if (COMMIT) {
      // fecha_ingreso pasa de DATETIME a VARCHAR(100) en la estructura nueva.
      // Con dateStrings:true en la conexión, r.fecha_ingreso ya viene como el
      // texto tal cual está guardado (sin pasar por ningún Date/UTC).
      const fechaStr = r.fecha_ingreso;
      await conn.query(
        `INSERT INTO \`${TARGET_DB}\`.entradas_bitacora (id, proyecto_id, usuario_id, descripcion, fecha_ingreso, tipo)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [r.id, r.new_project_id, r.usuario_id, r.descripcion, fechaStr, r.tipo],
      );
    }
  }

  log(
    "INFO",
    "REMAP",
    `entradas_bitacora: ${migrated} fila(s) con proyecto_id traducido de viejo→nuevo (mapeo recalculado por nombre), ${orphaned} huérfana(s) (sin proyecto nuevo correspondiente) ${COMMIT ? "movida(s) a tmp_orphan_bitacora" : "detectada(s)"}. Se descarta la columna "color".`,
  );

  if (orphaned > 0) {
    log("WARN", "REMAP", `entradas_bitacora tenía ${orphaned} fila(s) cuyo proyecto viejo no encontró pareja por nombre — revisar tmp_orphan_bitacora.`);
  }
}

// --- proyectos_families: traduce proyecto_id (bug de la migración pasada) --

async function copyProyectosFamilies(conn, projectMap) {
  const [rows] = await conn.query(`
    SELECT pf.proyecto_id as old_proyecto_id, pf.nombre, pf.apellido1, pf.apellido2, pf.id,
           pf.ingresos, pf.tipo_ingresos, pf.tipo_miembro, pf.id_link, pf.id_route,
           pf.telefono, pf.email, pf.tipo_id, pf.adulto, pf.discapacidad, pf.db_id
    FROM \`${STAGING_DB}\`.proyectos_families pf
  `);

  let migrated = 0;
  let orphaned = 0;

  for (const r of rows) {
    const mapped = projectMap.get(r.old_proyecto_id);
    r.new_project_id = mapped ? mapped.newProjectId : null;

    if (r.new_project_id === null) {
      orphaned++;
      if (COMMIT) {
        await conn.query(
          `INSERT INTO \`${TARGET_DB}\`.tmp_orphan_families (family_id, old_project_id, reason) VALUES (?, ?, ?)`,
          [r.db_id, r.old_proyecto_id, "No se encontró (por nombre) un proyecto nuevo correspondiente a este proyecto viejo"],
        );
      }
      continue;
    }

    migrated++;
    if (COMMIT) {
      await conn.query(
        `INSERT INTO \`${TARGET_DB}\`.proyectos_families
          (proyecto_id, nombre, apellido1, apellido2, id, ingresos, tipo_ingresos,
           tipo_miembro, id_link, id_route, telefono, email, tipo_id, adulto,
           discapacidad, db_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.new_project_id, r.nombre, r.apellido1, r.apellido2, r.id, r.ingresos,
          r.tipo_ingresos, r.tipo_miembro, r.id_link, r.id_route, r.telefono, r.email,
          r.tipo_id, r.adulto, r.discapacidad, r.db_id,
        ],
      );
    }
  }

  log(
    "INFO",
    "REMAP",
    `proyectos_families: ${migrated} fila(s) con proyecto_id traducido de viejo→nuevo (mapeo recalculado por nombre), ${orphaned} huérfana(s) ${COMMIT ? "movida(s) a tmp_orphan_families" : "detectada(s)"}.`,
  );

  if (orphaned > 0) {
    log("WARN", "REMAP", `proyectos_families tenía ${orphaned} fila(s) cuyo proyecto viejo no encontró pareja por nombre — revisar tmp_orphan_families.`);
  }
}

// --- notificaciones: se reconstruye con la estructura nueva -----------------
// Estructura vieja: usuario_id (nullable), message, leido, fecha_ingreso.
// Estructura nueva: usuario_id NOT NULL, proyecto_id, tipo, titulo, mensaje,
// remitente_usuario_id, leido, created_at. No hay forma confiable de inferir
// tipo/proyecto_id/remitente del texto libre viejo, así que (decisión ya
// confirmada): tipo='manual', titulo genérico, mensaje = message viejo,
// proyecto_id y remitente_usuario_id quedan NULL. Filas sin usuario_id se
// descartan (la columna es NOT NULL en la estructura nueva) y quedan
// registradas en el log.

async function copyNotificaciones(conn) {
  const [rows] = await conn.query(
    `SELECT id, usuario_id, message, leido, fecha_ingreso FROM \`${STAGING_DB}\`.notificaciones`,
  );

  let migrated = 0;
  let skippedNoUser = 0;

  for (const r of rows) {
    if (r.usuario_id === null) {
      skippedNoUser++;
      continue;
    }

    migrated++;
    if (COMMIT) {
      await conn.query(
        `INSERT INTO \`${TARGET_DB}\`.notificaciones
          (id, usuario_id, proyecto_id, tipo, titulo, mensaje, remitente_usuario_id, leido, created_at)
         VALUES (?, ?, NULL, 'manual', ?, ?, NULL, ?, ?)`,
        [r.id, r.usuario_id, "Notificación migrada (formato anterior)", r.message, r.leido, r.fecha_ingreso],
      );
    }
  }

  log(
    "INFO",
    "RESHAPE",
    `notificaciones: ${migrated} fila(s) migrada(s) con tipo='manual' y proyecto_id/remitente_usuario_id en NULL (no se pueden inferir del formato viejo), ${skippedNoUser} descartada(s) por no tener usuario_id (columna NOT NULL en la estructura nueva).`,
  );
}

// --- resumen de conteos (igual que la migración pasada) ---------------------

async function logCounts(conn) {
  const tables = [
    "proyectos", "proyectos_new", "proyectos_families", "entradas_bitacora",
    "notificaciones", "usuarios",
  ];
  for (const t of tables) {
    const [rows] = await conn.query(`SELECT COUNT(*) as c FROM \`${STAGING_DB}\`.\`${t}\``);
    log("INFO", "COUNTS", `staging.${t}=${rows[0].c}`);
  }
}

// --- main --------------------------------------------------------------

async function main() {
  console.log(`Modo: ${COMMIT ? "COMMIT (se va a crear/escribir la base destino)" : "DRY RUN (solo reporte, no se toca la base destino)"}\n`);

  const conn = await createConnection();

  await loadStaging(conn);
  await logCounts(conn);

  if (COMMIT) {
    await createTargetSchema(conn);
  } else {
    log("INFO", "SETUP", `(dry run) no se crea "${TARGET_DB}" — solo se reporta qué se haría.`);
  }

  // Se copian tablas sin respetar un orden estricto de dependencias (ej.
  // proyectos_families antes que proyectos_new), así que se desactivan los
  // chequeos de llave foránea durante la carga masiva — mismo truco que usa
  // mysqldump en sus propios archivos. Se reactivan apenas termina.
  if (COMMIT) {
    await conn.query(`SET FOREIGN_KEY_CHECKS=0`);
  }

  const projectMap = await computeFreshProjectMap(conn);

  await copyAsIs(conn);
  await copyFreshProjectMap(conn, projectMap);
  await copyEtapas(conn);
  await copyRoles(conn);
  await copyProyectosLegacy(conn);
  await copyEntradasBitacora(conn, projectMap);
  await copyProyectosFamilies(conn, projectMap);
  await copyNotificaciones(conn);

  if (COMMIT) {
    await conn.query(`SET FOREIGN_KEY_CHECKS=1`);
    await flushLogToTarget(conn);
    log("INFO", "DONE", `Base "${TARGET_DB}" armada completa.`);
  } else {
    console.log("\nEsto fue un dry run: no se creó ni modificó la base destino. Corré con --commit para aplicarlo de verdad.");
  }

  await conn.end();
  process.exit(0);
}

main().catch((error) => {
  console.error("Error corriendo el script:", error);
  process.exit(1);
});
