const express = require("express");
const router = express.Router();
const db = require("../../lib/db");

// Bitácora de movimientos del sistema (solo lectura, solo para admins —
// gateado en el frontend): reutiliza la misma tabla "notificaciones" que ya
// alimenta la campanita, pero sin filtrar por usuario_id, para ver TODO lo
// que se ha notificado en el sistema (proyectos creados, cambios de etapa,
// notificaciones manuales entre usuarios).
router.get("/", async (req, res) => {
  const notifications = await db
    .query(
      `select n.*,
        p.nombre as proyecto_nombre,
        CONCAT(dest.nombre, ' ', dest.apellido1) as destinatario_nombre,
        CONCAT(rem.nombre, ' ', rem.apellido1) as remitente_nombre
       from notificaciones n
       left join proyectos_new p on p.id = n.proyecto_id
       left join usuarios dest on dest.id = n.usuario_id
       left join usuarios rem on rem.id = n.remitente_usuario_id
       order by n.created_at desc
       limit 500`,
    )
    .catch((err) => {
      res.status(400).json({
        msg: "No se pudo conseguir la bitácora del sistema",
        error: err,
      });
      throw new Error("No se pudo conseguir la bitácora del sistema", err);
    });

  return res.status(200).json(notifications);
});

module.exports = router;
