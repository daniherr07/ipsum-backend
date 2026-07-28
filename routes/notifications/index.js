const express = require("express");
const router = express.Router();
const db = require("../../lib/db");

router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  console.log(`[GET /notifications/:userId] consultando notificaciones del usuario ${userId}`);

  if (!userId) {
    console.warn("[GET /notifications/:userId] falta userId en la petición");
    return res.status(400).json({ msg: "Falta el usuario" });
  }

  const [notifications, unreadRows] = await Promise.all([
    // join con proyectos_new/usuarios para mostrar en la campanita a qué
    // proyecto pertenece y quién la mandó (remitente_usuario_id es NULL en
    // las automáticas de cambio de etapa/proyecto nuevo, de ahí los LEFT JOIN).
    db.query(
      `select n.*, p.nombre as proyecto_nombre,
        CONCAT(u.nombre, ' ', u.apellido1) as remitente_nombre
       from notificaciones n
       left join proyectos_new p on p.id = n.proyecto_id
       left join usuarios u on u.id = n.remitente_usuario_id
       where n.usuario_id = ?
       order by n.created_at desc
       limit 50`,
      [userId],
    ),
    db.select("notificaciones", {
      values: "count(*) as count",
      where: "usuario_id = ? and leido = 0",
      params: [userId],
    }),
  ]).catch((err) => {
    console.error(
      `[GET /notifications/:userId] no se pudieron obtener las notificaciones (usuario ${userId})`,
      err,
    );
    res.status(400).json({
      msg: "No se pudieron obtener las notificaciones",
      error: err,
    });
    throw new Error("No se pudieron obtener las notificaciones", err);
  });

  return res.status(200).json({
    notifications,
    unreadCount: unreadRows[0]?.count || 0,
  });
});

module.exports = router;
