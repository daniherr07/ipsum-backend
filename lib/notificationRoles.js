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
// Portado de una versión anterior del sistema, que tenía 11 etapas con
// "subetapas"; el sistema actual tiene 15 etapas planas sin ese concepto,
// así que una etapa legada con sub-casos (ej. "Ingresó al Banvhi") se
// repite para cada etapa nueva equivalente. Las etapas sin una regla
// explícita en el código legado quedan en Analista, el único rol presente
// en absolutamente todos los casos originales.
const STAGE_NOTIFICATION_ROLES = {
  1: ["ANALISTA"], // Preanálisis
  2: ["INGENIERO"], // Visita
  3: ["ARQUITECTO", "ANALISTA"], // Confección Expediente
  4: ["ANALISTA"], // Enviado al Centro de Negocios (Avalúo: Condicionado)
  5: ["ANALISTA"], // Enviado al Centro de Negocios (Avalúo: Aprobado)
  6: ["ANALISTA"], // Ingreso al BANHVI (Registrado por Entidad)
  7: ["ANALISTA"], // Ingreso al BANHVI (Anomalías)
  8: ["ANALISTA"], // Ingreso al BANHVI (Emitido)
  9: ["ANALISTA"], // Ingreso al BANHVI (Aprobado)
  10: ["ANALISTA"], // Permisos de Construcción
  11: ["ANALISTA"], // Proceso de Formalización
  12: ["ANALISTA"], // Solicitud de Servicio Público
  13: ["ARQUITECTO", "INGENIERO", "ANALISTA"], // En Construcción
  14: ["ANALISTA"], // Entregado
  15: ["ANALISTA"], // Facturado
};

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
};
