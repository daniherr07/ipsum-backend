const express = require('express')
const app = express()
const cors = require('cors')


app.use(cors())
app.use(express.json());


var mysql = require("mysql2");

var hostname = "x6j.h.filess.io";
var database = "ipsum_warmpenwhy";
var port = "3307";
var username = "ipsum_warmpenwhy";
var password = "0e9e732d794b25a60b1b65e2067c23379da002a7";

var con = mysql.createConnection({
    host: hostname,
    user: username,
    password,
    database,
    port,
});

con.connect(function (err) {
    if (err) throw err;
    console.log("Connected!");
});


app.get('/test/:query', (req, res) => {
    const {query} = req.params
    con.query('Call findAll(?)', [query] ,(err, results) => {
        if (err) {
           res.json(err)
        }
        res.status(200).json(results[0])
    })
})


app.get('/projectNames', (req, res) => {
    con.query('select * from proyectos' ,(err, results) => {
        if (err) {
           res.json(err)
        }
        res.status(200).json(results)
    })
})

app.get('/getData/:name', (req, res) => {
    const {name} = req.params
    con.query('Call prueba(?)', [name] ,(err, results) => {
        if (err) {
           res.json(err)
        }
        res.status(200).json(results[0])
    })
})

app.post('/login', (req, res) => {
    const {user, psw} = req.body
    console.log("llego aqui 1")

    con.query('Select * from usuarios where nombre = ?', [user] ,(err, results) => {
        try{
            if (err) {
                return res.status(400).json(err)
            }


            if(results.length == 0){
                console.log("Error de longitud")
                return res.status(400).json({msj: "not users found"})

            }

            if (results[0].password == psw) {
                if (results[0].estado == 0) {
                    console.log("Usuario nuevo")
                    return res.status(200).json({msj: "Usuario autorizado", authorized: true, newUser: true, rol: results[0].rol_id})
                } else{
                    console.log("Usuario viejo")
                    return res.status(200).json({msj: "Usuario autorizado", authorized: true, newUser: false, rol: results[0].rol_id, user: user} )
                }
            } else{
                console.log("Error de contraseña")
                return res.status(400).json({msj: "Bad user or password"})
            }
        } catch (error){
            return res.status(400).json(error)
        }
    })
})

app.post('/changePassword', (req, res) => {
    const {user, email, psw, psw2} = req.body
    
    if (psw != psw2) {
        res.status(400).json({msj: "Passwords don't match", pswError: true})
        return
    }

    con.query('Select * from usuarios where nombre = ?', [user] ,(err, results) => {
            if (err) {
                return res.status(400).json(err)
            }
            console.log(results.length)

            if(results.length == 0){
                console.log("Error de longitud")
                return res.status(400).json({msj: "not users found", userError: true})
                
            }

            if (results[0].correo_electronico != email) {
                return res.status(400).json({msj: "Emails doent match", emailError: true})
            }

            con.query('UPDATE usuarios SET estado = 1 WHERE nombre = ?', [user] ,(err, results) => {
            })
            
            con.query('UPDATE usuarios SET password = ? WHERE nombre = ?', [psw, user] ,(err, results) => {
                return res.status(200).json({msj: "Succesfuly Updated", correct: true})
            })




    })
})

  

app.listen(3001, () => {
    console.log("Hola mundo")
})

module.exports = app;