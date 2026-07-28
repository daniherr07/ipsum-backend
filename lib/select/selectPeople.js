const db = require("../db");

async function selectPeople(projectID) {
  const keys = [
    "constructor_id",
    "arquitecto_id",
    "promotor_id",
    "analista_id",
    "ingeniero_id",
    "fiscal_id",
  ];

  const data = await db.select("proyectos_people", {
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

module.exports = selectPeople;
