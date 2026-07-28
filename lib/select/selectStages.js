const db = require("../db");

async function selectStages(projectID) {
  const keys = ["etapa_id"];

  const data = await db.select("proyectos_stages", {
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

module.exports = selectStages;
