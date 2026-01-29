const db = require("../db");

async function selectFamilies(projectID) {
  const keys = [
    "id",
    "tipo_id",
    "nombre",
    "apellido1",
    "apellido2",
    "ingresos",
    "tipo_ingresos",
    "tipo_miembro",
    "id_link",
    "id_route",
    "telefono",
    "adulto",
    "discapacidad",
    "email",
  ];

  const data = await db.select("proyectos_families", {
    values: "*",
    where: "proyecto_id = ?",
    params: [projectID],
  });

  const values = data.map((row) => {
    const obj = {};
    for (const key of keys) {
      obj[key] = row?.[key] ?? "";
    }
    return obj;
  });

  return values;
}

module.exports = selectFamilies;
