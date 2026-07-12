const express = require("express");
const router = express.Router();
const db = require("../../lib/db");

router.get("/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ msg: "Falta el usuario" });
  }

  const [notifications, unreadRows] = await Promise.all([
    db.select("notificaciones", {
      values: "*",
      where: "usuario_id = ? order by created_at desc limit 50",
      params: [userId],
    }),
    db.select("notificaciones", {
      values: "count(*) as count",
      where: "usuario_id = ? and leido = 0",
      params: [userId],
    }),
  ]).catch((err) => {
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
