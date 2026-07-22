const express = require("express");
const router = express.Router();
const {
  getAllStageNotificationRoleLabels,
} = require("../../lib/notificationRoles");

// No toca la base de datos (STAGE_NOTIFICATION_ROLES es un mapa fijo en
// código), así que no hace falta cachear esto — ya es prácticamente
// instantáneo. Se usa en el editor de proyecto para mostrar, junto a cada
// etapa, a quién se le va a avisar si el usuario hace clic en ella.
router.get("/", (req, res) => {
  console.log("[GET /stageNotificationRoles] consultando roles de notificación por etapa");
  return res.status(200).json(getAllStageNotificationRoleLabels());
});

module.exports = router;
