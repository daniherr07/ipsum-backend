const express = require("express");
const router = express.Router();
const db = require("../../lib/db");
const cache = require("../../lib/cache");

// Antes esta ruta hacía 1 consulta para conseguir los ids y luego llamaba
// "call projectOverview(id)" una vez POR CADA proyecto (136 llamadas
// separadas a la base de datos para 136 proyectos). Este query hace lo
// mismo que el stored procedure projectOverview pero para TODOS los
// proyectos de una sola vez, sin el filtro "where p.id = ProjectID". Se
// reescribió acá en vez de modificar el procedure en la base de datos para
// no tocar un objeto de producción fuera de este repositorio.
const ALL_PROJECTS_QUERY = `
  select
    p.id as id,
    p.nombre as nombre,
    p.activo as activo,
    b.descripcion as descripcion,
    p.created_at as created_at,
    tb.nombre as bono,
    tb.id as bono_id,
    vb.nombre as variante_bono,
    vb.id as variante_bono_id,
    gr.nombre as grupo,
    l.provincia as provincia,
    l.canton as canton,
    l.distrito as distrito,
    l.otro as otro,
    en.nombre as entidad,
    cn.nombre as centro_negocio,
    CONCAT(con.nombre, ' ', con.apellido1) as p_constructor,
    CONCAT(arq.nombre, ' ', arq.apellido1) as arquitecto,
    CONCAT(prom.nombre, ' ', prom.apellido1) as promotor,
    CONCAT(an.nombre, ' ', an.apellido1) as analista,
    CONCAT(ing.nombre, ' ', ing.apellido1) as ingeniero,
    CONCAT(fis.nombre, ' ', fis.apellido1) as fiscal,
    pe.arquitecto_id as arquitecto_id,
    pe.analista_id as analista_id,
    pe.ingeniero_id as ingeniero_id,
    st.etapa_id as etapa_id
  from proyectos_new p
  left join proyectos_basics b on b.proyecto_id = p.id
    left join tipos_bono tb on b.bono_id = tb.id
    left join variantes_bono vb on b.variante_bono_id = vb.id
    left join grupos_proyectos gr on b.grupo_id = gr.id
  left join proyectos_locations l on l.proyecto_id = p.id
  left join proyectos_admins ad on ad.proyecto_id = p.id
    left join entidades en on ad.entidad_id = en.id
    left join centros_negocios cn on ad.centro_negocio_id = cn.id
  left join proyectos_people pe on pe.proyecto_id = p.id
    left join constructores con on pe.constructor_id = con.id
    left join usuarios arq on pe.arquitecto_id = arq.id
    left join promotores_ipsum prom on pe.promotor_id = prom.id
    left join usuarios an on pe.analista_id = an.id
    left join usuarios ing on pe.ingeniero_id = ing.id
    left join fiscales fis on pe.fiscal_id = fis.id
  left join proyectos_stages st on st.proyecto_id = p.id
  order by p.id desc
`;

// TTL corto: esta lista se invalida activamente (ver cache.delete("allProjects")
// en new/changeStage/insertBasics/insertLocations/insertAdmins/insertPeople),
// así que el TTL es solo un respaldo por si algo cambia la data sin pasar
// por esas rutas (ej. directo en la base de datos).
const CACHE_TTL_MS = 60_000;

router.get("/", async (req, res) => {
  console.log("[GET /allProjects] consultando listado de proyectos (cache o BD)");
  const projects = await cache
    .getOrSet("allProjects", CACHE_TTL_MS, () => db.query(ALL_PROJECTS_QUERY))
    .catch((err) => {
      console.error(
        "[GET /allProjects] no se pudo conseguir la lista de proyectos",
        err,
      );
      res.status(400).json({
        msg: "No se pudo conseguir la lista de proyectos",
        error: err,
      });
      throw new Error("No se pudo conseguir la lista de proyectos", err);
    });

  return res.status(200).json(projects);
});

module.exports = router;
