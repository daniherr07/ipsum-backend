const express = require('express')
const app = express()
const cors = require('cors')

app.use(cors())

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

app.listen(3001, () => {
    console.log("Hola mundo")
})

module.exports = app;