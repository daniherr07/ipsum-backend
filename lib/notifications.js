const db = require("./db");

// Inserta una notificación in-app por destinatario. Se usa junto al envío
// de correo (proyecto nuevo, cambio de etapa, notificación manual) para que
// quede también registrada en la campanita del navbar.
async function createNotifications(notifications) {
  return Promise.all(
    notifications.map((n) =>
      db.insert("notificaciones", {
        usuario_id: n.usuario_id,
        proyecto_id: n.proyecto_id ?? null,
        tipo: n.tipo,
        titulo: n.titulo,
        mensaje: n.mensaje ?? null,
        remitente_usuario_id: n.remitente_usuario_id ?? null,
      }),
    ),
  );
}

module.exports = { createNotifications };
