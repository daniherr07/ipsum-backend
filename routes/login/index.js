const express = require("express");
const router = express.Router();
const db = require("../../lib/db");

router.post("/", async (req, res) => {
  if (!req.body) {
    console.log(req.body)
    res.status(400).json({ msg: "Petición de login inválida, debe tener un cuerpo" });
    throw new Error('Petición Inválida: Sin Cuerpo')
  }

  const { user, password } = req.body;

  const response = await db.select("usuarios", {
    values: "id",
    where: "nombre = ? or correo_electronico = ?",
    params: [user, user],
  });

  return res.status(200).json(response);
});

/*
app.post('/login', (req, res) => {
  const {user, psw} = req.body

  pool.query('call getUserWithRole(?)', [user] ,(err, results) => {
      try{
          if (err) {
              console.log(err)
              return res.status(400).json(err)
          }

          if(results.length == 0){
              return res.status(400).json({msj: "not users found"})
          }

          if (results[0][0].activated == 0) {
              return res.status(400).json({msj: "not users found", activated:false})
          }

          // Compare the provided password with the stored hash
          bcrypt.compare(psw, results[0][0].password, (err, isMatch) => {
              if (err) {
                console.log(err)
                  return res.status(500).json({msj: "Error comparing passwords", error: true})
              }
              console.log(isMatch)
              if (isMatch) {
                
                  if (results[0][0].estado == 0) {
                      return res.status(200).json({msj: "Usuario autorizado", authorized: true, newUser: true, rol: results[0][0].role_name})
                  } else{
                      return res.status(200).json({msj: "Usuario autorizado", authorized: true, id: results[0][0].id , newUser: false, rol: results[0][0].role_name, user: results[0][0].user_name})
                  }
              } else {
                  return res.status(400).json({msj: "Bad user or password"})
              }
          })
              
      } catch (error){
          console.log(error)
          return res.status(400).json(error)
      }
  })
})

*/

module.exports = router;
