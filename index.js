const express = require('express')
const app = express()
const cors = require('cors')

app.use(cors())

var mysql = require("mysql2");

var hostname = "sql.freedb.tech";
var database = "freedb_IpsumDB";
var port = "3306";
var username = "freedb_adminIpsum";
var password = "$YUMfqrbKp#Xr9P";

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