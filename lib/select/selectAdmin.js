const db = require("../db");

async function selectAdmin(projectID) {
  const keys = [
    "entidad_id", 
    "centro_negocio_id", 
    "analista_entidad_id", 
    "presupuesto",
    "avaluo",
    "apc",
    "cfia"
  ];

  const data = await db.select("proyectos_admins", {
    values: "*",
    where: "proyecto_id = ?",
    params: [projectID],
  });

  let values = {};

  for (const key of keys) {
    values[key] = data?.[0]?.[key] ?? "";
  }

  return values;
}

module.exports = selectAdmin;
