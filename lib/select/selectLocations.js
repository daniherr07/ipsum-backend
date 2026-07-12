const db = require("../db");

async function selectLocations(projectID) {
  const keys = [
    "provincia",
    "canton",
    "distrito",
    "otro",
    "propietario",
    "tipo_propietario",
    "plano_catastro",
    "finca",
    "google_url",
  ];

  const data = await db.select("proyectos_locations", {
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

module.exports = selectLocations;
