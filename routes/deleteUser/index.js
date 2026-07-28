const express = require("express");
const router = express.Router();
const db = require("../../lib/db");
const cache = require("../../lib/cache");

// "Eliminar" un usuario es un borrado lógico (activated = 0), no un DELETE
// físico: otras tablas (proyectos_people.analista_id/arquitecto_id/
// ingeniero_id, entradas_bitacora.usuario_id, notificaciones.usuario_id)
// referencian este id, y un DELETE real dejaría esas filas huérfanas o
// fallaría por integridad referencial. Con activated = 0 el usuario
// desaparece de la lista y de las notificaciones (esas consultas ya filtran
// "activated = 1"), sin romper el historial de proyectos pasados.
router.post("/", async (req, res) => {
  if (!req.body) {
    res.status(400).json({ msg: "Petición inválida, debe tener un cuerpo" });
    throw new Error("Petición Inválida: Sin Cuerpo");
  }

  const { id } = req.body;
  console.log(`[POST /deleteUser] desactivando usuario id ${id}`);

  if (!id) {
    return res.status(400).json({ msg: "Falta el usuario a eliminar" });
  }

  const result = await db
    .update("usuarios", { activated: 0 }, "id = ?", [id])
    .catch((err) => {
      console.error(`[POST /deleteUser] no se pudo desactivar el usuario ${id}`, err);
      res.status(400).json({ msg: "No se pudo eliminar el usuario", error: err });
      throw new Error("No se pudo eliminar el usuario", err);
    });

  console.log(`[POST /deleteUser] usuario ${id} desactivado correctamente`);

  cache.delete("selectUsers");

  return res.status(200).json(result);
});

module.exports = router;
