const db = require("./db");

// Grupos de rol para notificaciones por correo. Cada grupo junta el rol
// base con su variante "* Admin": hoy nadie tiene el rol "Analista" puro
// (rol_id 3) — solo existe "Analista Admin" (rol_id 7, Magda) — así que
// agrupar es necesario para que las notificaciones de Analista le lleguen
// a alguien.
const ROLE_GROUPS = {
  ANALISTA: [3, 7],
  INGENIERO: [5, 9],
  ARQUITECTO: [6, 10],
  ADMIN: [2],
};

// A qué grupos de rol avisar cuando un proyecto entra a cada etapa.
// Portado de una versión anterior del sistema, que tenía 15 etapas con
// "subetapas" (ej. "Ingreso al BANHVI" se repetía 4 veces con distinto id
// para cada sub-caso); el sistema actual tiene 11 etapas planas sin ese
// concepto (ver tabla `etapas`), así que cada grupo de sub-casos legado se
// colapsó a una sola entrada usando el id real de la etapa equivalente. Las
// etapas sin una regla explícita en el código legado quedan en Analista, el
// único rol presente en absolutamente todos los casos originales.
//
// IMPORTANTE: estas keys son los id reales de la tabla `etapas`, no ids
// arbitrarios — antes de este fix, ids 5 en adelante apuntaban a la etapa
// legada equivocada (ej. key 9 = "Ingreso al BANHVI" legado en vez de la
// etapa 9 real, "En Construcción"), por lo que Arquitecto/Ingeniero dejaban
// de notificarse en "En Construcción" y las demás etapas después de
// "Enviado al Centro de Negocios".
const STAGE_NOTIFICATION_ROLES = {
  1: ["ANALISTA"], // Preanálisis
  2: ["INGENIERO"], // Visita
  3: ["ARQUITECTO", "ANALISTA"], // Confección Expediente
  4: ["ANALISTA"], // Enviado al Centro de Negocios
  5: ["ANALISTA"], // Ingreso al BANHVI
  6: ["ANALISTA"], // Permisos de Construcción
  7: ["ANALISTA"], // Proceso de Formalización
  8: ["ANALISTA"], // Solicitud de Servicio Público
  9: ["ARQUITECTO", "INGENIERO", "ANALISTA"], // En Construcción
  10: ["ANALISTA"], // Entregado
  11: ["ANALISTA"], // Facturado
};

// Nombres legibles de cada grupo, para mostrarle al usuario en el frontend
// a quién le va a llegar el aviso al cambiar de etapa (ver
// getStageNotificationRoleLabels más abajo).
const ROLE_GROUP_LABELS = {
  ANALISTA: "Analista",
  INGENIERO: "Ingeniero",
  ARQUITECTO: "Arquitecto",
  ADMIN: "Administrador",
};

// Etiquetas (no ids/correos) de a quién se notifica en una etapa dada,
// siempre incluyendo Administrador — igual que getStageNotificationUsers,
// pero sin tocar la base de datos: es solo para mostrarlo en el frontend.
function getStageNotificationRoleLabels(etapaId) {
  const groups = STAGE_NOTIFICATION_ROLES[etapaId] || ["ANALISTA"];
  const uniqueGroups = new Set([...groups, "ADMIN"]);
  return [...uniqueGroups].map((group) => ROLE_GROUP_LABELS[group]);
}

// Misma información que getStageNotificationRoleLabels, pero para todas las
// etapas definidas de una vez (así el frontend la pide una sola vez).
function getAllStageNotificationRoleLabels() {
  const result = {};
  for (const etapaId of Object.keys(STAGE_NOTIFICATION_ROLES)) {
    result[etapaId] = getStageNotificationRoleLabels(Number(etapaId));
  }
  return result;
}

// Devuelve id + correo (no solo el correo) porque el id hace falta para
// crear la notificación in-app además de mandar el email.
async function getUsersByRoles(roleIds) {
  if (!roleIds || roleIds.length === 0) return [];

  const placeholders = roleIds.map(() => "?").join(", ");
  return db.select("usuarios", {
    values: "id, correo_electronico",
    where: `rol_id IN (${placeholders}) AND activated = 1`,
    params: roleIds,
  });
}

async function getAdminUsers() {
  return getUsersByRoles(ROLE_GROUPS.ADMIN);
}

// Usuarios (id + correo) de los roles que deben enterarse de un cambio a
// esta etapa, siempre incluyendo al Administrador.
async function getStageNotificationUsers(etapaId) {
  const groups = STAGE_NOTIFICATION_ROLES[etapaId] || ["ANALISTA"];
  const roleIds = new Set([
    ...groups.flatMap((group) => ROLE_GROUPS[group]),
    ...ROLE_GROUPS.ADMIN,
  ]);

  return getUsersByRoles([...roleIds]);
}

module.exports = {
  ROLE_GROUPS,
  STAGE_NOTIFICATION_ROLES,
  getUsersByRoles,
  getAdminUsers,
  getStageNotificationUsers,
  getStageNotificationRoleLabels,
  getAllStageNotificationRoleLabels,
};
