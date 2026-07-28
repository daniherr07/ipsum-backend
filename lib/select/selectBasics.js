const db = require("../db");

async function selectBasics(projectID) {
  const keys = ["bono_id", "variante_bono_id", "grupo_id", "descripcion", "fis"];

  const data = await db.select("proyectos_basics", {
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

module.exports = selectBasics;
