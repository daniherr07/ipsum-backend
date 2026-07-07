const express = require("express");
const router = express.Router();
const db = require("../../lib/db");

router.get("/", async (req, res) => {
  const projectsId = await db
    .select("proyectos_new", {
      values: "id",
      where: "1 = 1 order by id desc",
      params: [],
    })
    .catch((err) => {
      res.status(400).json({
        msg: "No se pudo conseguir la cuenta de los proyectos",
        error: err,
      });
      throw new Error("No se pudo conseguir la cuenta de los proyectos", err);
    });

  const projects = [];

  for (const item of projectsId) {
    const projectItem = await db
      .query(`call projectOverview(${item.id})`)
      .catch((err) => {
        res.status(400).json({
          msg: `No se pudo conseguir la información del proyecto ${item.id}`,
          error: err,
        });
        throw new Error(
          `No se pudo conseguir la información del proyecto ${item.id}` + err
        );
      });

    projects.push(projectItem[0][0]);
  }

  

  return res.status(200).json(projects);
});

module.exports = router;
