const express = require('express')
const app = express()
const cors = require('cors')
const bodyParser = require('body-parser');
const generatePassword = require('generate-password')
const nodemailer = require("nodemailer");
require('dotenv').config()
const bcrypt = require('bcryptjs');

app.use(cors())
app.use(bodyParser.json());
app.use(express.json())

const saltRounds = 10;

var mysql = require("mysql2");


// Replace single connection with a connection pool
var pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DEFAULT,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    ssl: {
        rejectUnauthorized: true
    }
});

// No need for explicit connection - the pool manages connections automatically
console.log("Connection pool created!");

app.get('/filter', (req, res) => {
  const { table, rol_id, nombre } = req.query;
  let isDisabled = req.query.activated == 0 ? true : false
  const nombreArray = nombre.split(',');

  if (rol_id) {
    pool.query('SELECT Concat(??, " ", ??, " ", ??) as nombre, id FROM usuarios where rol_id = ?', [nombreArray[0], nombreArray[1], nombreArray[2], rol_id], (err, results) => {
      if (err) {
        return res.json(err);
      }
      return res.status(200).json(results);
    });
  } else if (isDisabled){
    pool.query('SELECT nombre, id from proyectos where activated = 0', [nombreArray[0], nombreArray[1], nombreArray[2], table], (err, results) => {
      if (err) {
        return res.json(err);
      }
      return res.status(200).json(results);
    });

  } else {
    if (nombreArray.length > 1) {

      pool.query(`SELECT Concat(??, " ", ??, " ", ??) as nombre, id FROM ??`, [nombreArray[0], nombreArray[1], nombreArray[2], table], (err, results) => {
        if (err) {
          return res.json(err);
        }
        return res.status(200).json(results);
      });
      
    } else {
      pool.query(`SELECT ??, id FROM ?? ${isDisabled == false && "where activated = 1"} `, [nombre, table], (err, results) => {
        if (err) {
          return res.json(err);
        }
        return res.status(200).json(results);
      });
    }
  }
});

app.get('/projectNames', (req, res) => {
  const query = req.query;
  const values = query.value.split(',');
  const order = query.order
  const isDisabled = query.isDisabled
  const label = query.label.split(',')
  const etapa_id = query.etapa_id.split(',')
  const tipo_bono_id = query.tipo_bono_id.split(',')
  const role_filter = query.filter_role
  const user_id = query.user_id

  console.log(query)

  let sqlQuery = "SELECT nombre, id, estado_color FROM proyectos  "

  if ((label != "undefined") && (values != "undefined")) {
    console.log("label")
    if (label.length > 1) {
      if (label[1] == "activated") {
        sqlQuery += `WHERE ${label[0]} in (${values})`
      }
    }else {
      sqlQuery += `WHERE ${label} in (${values})`
    }

    
  }

  if (etapa_id != "undefined") {
    console.log("etapa")
    if ((label != "undefined") && (values != "undefined")) {
      sqlQuery += ` and etapa_actual_id in (${etapa_id})`
    } else{
      sqlQuery += ` WHERE etapa_actual_id in (${etapa_id})`
    }
    
  }

  if (tipo_bono_id != "undefined") {
    console.log("tipo bono id")
    if ((label != "undefined" && values != "undefined") || (etapa_id != "undefined")) {
      sqlQuery += ` and tipo_bono_id in (${tipo_bono_id})`
    } else {
      sqlQuery += ` WHERE tipo_bono_id in (${tipo_bono_id})`
    }
    
  }

  if (role_filter != "undefined") {
    console.log("role_filter")
    if ((label != "undefined" && values != "undefined") || (etapa_id != "undefined") || (tipo_bono_id != "undefined")) {
      sqlQuery += ` and ${role_filter} in (${user_id})`
    } else {
      sqlQuery += ` WHERE ${role_filter} in (${user_id})`
    }
    
  }

  if (isDisabled != "undefined") {
    console.log("is disabled")
    if ((label != "undefined" && values != "undefined") || (etapa_id != "undefined") || (tipo_bono_id != "undefined") || (role_filter != "undefined")) {
      sqlQuery += ` and activated = ${isDisabled}`
    } else{
      sqlQuery += ` WHERE activated = ${isDisabled}`
    }
  }

  sqlQuery += ` order by fecha_ingreso ${order}`

  pool.query(sqlQuery, (err, results) => {
    if (err) {
      console.log(err)
      return res.json(err);
    }

    return res.status(200).json(results);
  });
});

app.get('/getData/:name', (req, res) => {
    const {name} = req.params
    pool.query('Call getCardInfo(?)', [name] ,(err, results) => {
        if (err) {
            return res.json(err)
        }
        return res.status(200).json(results)
    })
})

app.get('/getUsers', (req, res) => {
  pool.query('call getAllUsers()',(err, results) => {
    try{
        if (err) {
            return res.status(400).json(err)
        }

        return res.status(200).json(results[0])
    } catch (error){
        return res.status(400).json(error)
    }
  })
})

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

app.post('/changePassword', (req, res) => {
  const {user, email, psw, psw2} = req.body
  
  if (psw != psw2) {
      res.status(400).json({msj: "Passwords don't match", pswError: true})
      return
  }

  pool.query('Select * from usuarios where nombre = ?', [user] ,(err, results) => {
      if (err) {
          return res.status(400).json(err)
      }

      if(results.length == 0){
          return res.status(400).json({msj: "not users found", userError: true})
      }

      if (results[0].correo_electronico != email) {
          return res.status(400).json({msj: "Emails doent match", emailError: true})
      }

      pool.query('UPDATE usuarios SET estado = 1 WHERE nombre = ?', [user] ,(err, results) => {
      })
      
      // Hash the password before storing it
      bcrypt.hash(psw, saltRounds, (err, hash) => {
          if (err) {
              return res.status(500).json({msj: "Error hashing password", error: true})
          }
          
          pool.query('UPDATE usuarios SET password = ? WHERE nombre = ?', [hash, user] ,(err, results) => {
              if (err) {
                  return res.status(500).json({msj: "Error updating password", error: true})
              }
              return res.status(200).json({msj: "Successfully Updated", correct: true})
          })
      })
  })
})

app.get('/getBonos', (req, res) => {
    pool.query('Call getBonos()', (err, results) => {
        if (err) {
            return res.json(err)
        }
        const data = organizeBonos(results[0])
        return res.status(200).json(data)
    })
})

  
app.get('/getAdminData/', (req, res) => {
    pool.query('Call ObtenerNombresRelevantes()', (err, results) => {
        if (err) {
            return res.json(err)
        }
        const data = organizeAdminData(results[0])
        return res.status(200).json(data)
    })
})

function organizeAdminData(data) {
    const organizedData = {
      Analista_de_Entidades: [],
      Fiscal: [],
      Promotor_Ipsum: [],
      Analista_Ipsum: [], // Add the new type here
      Ingeniero: [],
      Entidad: [],
      Arquitecto: [],
      Constructor: [],
    };
  
    // First pass: organize by type and collect entities
    data.forEach(item => {
      if (item.Tipo === 'Entidad') {
        const entityData = {
          localId: item.localID,  
          Tipo: item.Tipo,
          Nombre: item.Entidad,
          Centros_de_Negocio: [],
          activated: item.activated,
        };
        organizedData.Entidad.push(entityData);
      } else if (item.Tipo in organizedData) {
        // Remove unnecessary fields and add to the appropriate array
        const { Centro_de_Negocio, ...rest } = item;
        organizedData[item.Tipo].push(rest);
      }
    });
  
    // Second pass: add business centers to their respective entities
    data.forEach(item => {
      if (item.Tipo === 'Centro_de_Negocios') {
        const entity = organizedData.Entidad.find(e => e.Nombre === item.Entidad);
        if (entity) {
          const itemData = {localId: item.localID, nombre: item.Centro_de_Negocio, activated: item.activated}
          entity.Centros_de_Negocio.push(itemData);
        }
      }
    });
  
    return organizedData;
  }

function organizeBonos(data){
    const result = Object.values(
        data.reduce((acc, { TipoBonoID, TipoBonoNombre, VarianteID, VarianteNombre, ActivatedBono, ActivatedVariante }) => {
          // Si el TipoBonoID no existe aún en el acumulador, lo inicializamos
          if (!acc[TipoBonoID]) {
            acc[TipoBonoID] = {
              id: TipoBonoID,
              nombre: TipoBonoNombre,
              subtipos: [],
              activated: ActivatedBono
            };
          }
      
          // Si la variante no es null, la añadimos al array de subtipos
          if (VarianteID && VarianteNombre) {
            acc[TipoBonoID].subtipos.push({ id: VarianteID, nombre: VarianteNombre, activated: ActivatedVariante });
          }
      
          return acc;
        }, {})
      );
    return result
}

app.post('/saveData/', async (req, res) => {
    const { projectData, familyMembers, directionData, formDataAdmin } = req.body;

    console.log(formDataAdmin)
    async function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  
    // Validate that there's at least one family member who is the head of the household
    const hasHeadOfHousehold = familyMembers.some(member => member.tipoMiembro === 'Jefe/a de Familia');
    if (!hasHeadOfHousehold) {
      return res.status(400).json({ message: 'Debe haber al menos un miembro de familia que sea jefe/a de hogar' });
    }

    var newSubtipoSeleccionado = projectData.subtipoSeleccionado
  
    if (!newSubtipoSeleccionado) {
      newSubtipoSeleccionado = null
    }
  
    try {
      async function crearProyecto() {
        pool.query('SELECT id FROM variantes_bono WHERE id = ?', [newSubtipoSeleccionado], (err, results) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Error checking variante_bono_id', error: err.message });
          }
    
          try {
            // Get a connection from the pool for transaction
            pool.getConnection((err, connection) => {
              if (err) {
                console.error('Transaction error:', err);
                return res.status(500).json({ message: 'Error al iniciar la transacción', error: err.message });
              }
              
              // Begin transaction
              connection.beginTransaction((err) => {
                if (err) {
                  connection.release();
                  console.error('Transaction error:', err);
                  return res.status(500).json({ message: 'Error al iniciar la transacción', error: err.message });
                }
                
                // Insert propietario
                connection.query('INSERT INTO propietarios (tipo_propietario_id, cedula) VALUES (?, ?)', 
                  [directionData.loteTipoIdentificacion == "pendiente" ? null : directionData.loteTipoIdentificacion, 
                    directionData.loteIdentificacion == "pendiente" ? null : directionData.loteIdentificacion], 
                  (err, propietarioResult) => {
                    if (err) {
                      return connection.rollback(() => {
                        connection.release();
                        console.error('Propietario insertion error:', err);
                        res.status(500).json({ message: 'Error al insertar propietario', error: err.message });
                      });
                    }
          
                    const propietarioId = propietarioResult.insertId;
          
                    // Insert lote
                    connection.query('INSERT INTO lotes (propietario_id, numero_plano_catastro, numero_finca, provincia, distrito, canton, senas_descripcion) VALUES (?, ?, ?, ?, ?, ?, ?)',
                      [propietarioId, directionData.numeroPlanoCatastro, directionData.finca, directionData.provincia, directionData.distrito, directionData.canton, directionData.otrasSenas],
                      (err, loteResult) => {
                        if (err) {
                          return connection.rollback(() => {
                            connection.release();
                            console.error('Lote insertion error:', err);
                            res.status(500).json({ message: 'Error al insertar lote', error: err.message });
                          });
                        }
          
                        const loteId = loteResult.insertId;
          
                        // Insert proyecto
                        const headOfFamily = familyMembers.find(member => member.tipoMiembro == 'Jefe/a de Familia');
                        const projectName = `${headOfFamily.nombre} ${headOfFamily.primerApellido} ${headOfFamily.segundoApellido}`;
          
                        connection.query('INSERT INTO proyectos (nombre, descripcion, grupo_proyecto_id, tipo_bono_id, variante_bono_id, lote_id, fecha_ingreso, presupuesto, avaluo, entidad_id, centro_negocio_id, analista_asigna_entidad_id, analista_asigna_ipsum_id, fiscal_id, ingeniero_id, arquitecto_id, promotor_interno_id, codigo_apc, codigo_cfia, fis, constructor_id) VALUES (?, ?, ?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                          [projectName, 
                           projectData.desc, 
                           projectData.grupoSeleccionado, 
                           projectData.bonoSeleccionado, 
                           newSubtipoSeleccionado, 
                           loteId, 
                           formDataAdmin.presupuesto == "" ? null : formDataAdmin.presupuesto, 
                           formDataAdmin.avaluo == "" ? null : formDataAdmin.avaluo, 
                           formDataAdmin.entidad, 
                           formDataAdmin.entidadSecundaria == "pendiente" ? null : formDataAdmin.entidadSecundaria, 
                           formDataAdmin.analistaEntidad == "pendiente" ? null : formDataAdmin.analistaEntidad, 
                           formDataAdmin.analistaIPSUM, 
                           formDataAdmin.fiscalAsignado == "pendiente" ? null : formDataAdmin.fiscalAsignado, 
                           formDataAdmin.ingenieroAsignado == "pendiente" ? null : formDataAdmin.ingenieroAsignado, 
                           formDataAdmin.arquitecto == "pendiente" ? null : formDataAdmin.arquitecto, 
                           formDataAdmin.Promotor_Ipsum == "pendiente" ? null : formDataAdmin.Promotor_Ipsum, 
                           formDataAdmin.apc, 
                           formDataAdmin.cfia, 
                           projectData.hasFIS,
                           formDataAdmin.constructor == "pendiente" ? null : formDataAdmin.constructor,],
                          (err, proyectoResult) => {
                            if (err) {
                              return connection.rollback(() => {
                                connection.release();
                                console.error('Proyecto insertion error:', err);
                                res.status(500).json({ message: 'Error al insertar proyecto', error: err.message });
                              });
                            }
          
                            const proyectoId = proyectoResult.insertId;
        
                            // Insert family members
                            const familyValues = familyMembers.map(member => [
                              proyectoId, 
                              member.tipoMiembro || null, 
                              member.nombre || null, 
                              member.primerApellido || null, 
                              member.segundoApellido || null,
                              member.identificacion || null, 
                              member.tipoIdentificacion || null, 
                              member.ingresos || null, 
                              member.tipoIngresos || null,
                              member.telefono || null, 
                              member.email || null, 
                              member.adultoMayor || false, 
                              member.discapacidad || false,
                              member.cedulaFile || null
                            ]);
          
                            connection.query('INSERT INTO familias (proyecto_id, tipo_miembro, nombre, apellido1, apellido2, cedula, tipo_cedula, ingreso, tipo_ingreso, telefono, email, adulto_mayor, discapacidad, imagen_cedula) VALUES ?',
                              [familyValues],
                              (err) => {
                                if (err) {
                                  return connection.rollback(() => {
                                    connection.release();
                                    console.error('Family members insertion error:', err);
                                    res.status(500).json({ message: 'Error al insertar miembros de la familia', error: err.message });
                                  });
                                }
                                
                                // Commit the transaction
                                connection.commit((err) => {
                                  if (err) {
                                    return connection.rollback(() => {
                                      connection.release();
                                      console.error('Commit error:', err);
                                      res.status(500).json({ message: 'Error al finalizar la transacción', error: err.message });
                                    });
                                  }
                                  
                                  // Release the connection back to the pool
                                  connection.release();
                                });
                              }
                            );
                          }
                        );
                      }
                    );
                  }
                );
              });
            });
          } catch (err) {
              console.log(err)
          }
        });
      }
  
      await crearProyecto()
  
      await sleep(3000)
  
        pool.query('select * from proyectos order by id desc', (err, results) => {
          if (err) {
            console.log(err)
              return res.json(err)
          }
          return res.status(200).json({ message: 'Proyecto guardado exitosamente', ok: true, results: results[0] });
        })
    } catch (error) {
      return res.status(200).json({ message: 'Error al guardar el proyecto', ok: false});
    }
});
  
app.post('/updateUser', (req, res) => {
  const {id, lastName1, lastName2, userName, roles, email} = req.body

  var roleId;

  switch (roles) {
    case "Root":
      roleId = 1;
      break;

    case "Admin":
      roleId = 2;
      break;

    case "Analista":
      roleId = 3;
      break;

    case "Promotor":
      roleId = 4;
      break;

    case "Ingeniero":
      roleId = 5;
      break;

    case "Arquitecto":
      roleId = 6;
      break;

    case "Ingeniero Admin":
      roleId = 9
      break;

    case "Analista Admin":
      roleId = 7
      break;
    
    case "Arquitecto Admin":
      roleId = 10;
  }

  pool.query('UPDATE usuarios SET nombre = ?, apellido1 = ?, apellido2 = ?, rol_id = ?, correo_electronico = ? WHERE id = ?', [userName, lastName1, lastName2, roleId,email, id ] ,(err, results) => {
    try{
        if (err) {
            console.log(err)
            return res.status(400).json(err)
            
        }
        return res.status(200).json(results[0])
    } catch (error){
        return res.status(400).json(error)
    }
  })
})

app.post('/addUser', (req, res) => {
  const {lastName1, lastName2, userName, roles, email} = req.body

  var roleId;

  switch (roles) {
    case "Root":
      roleId = 1;
      break;

    case "Admin":
      roleId = 2;
      break;

    case "Analista":
      roleId = 3;
      break;

    case "Promotor":
      roleId = 4;
      break;

    case "Ingeniero":
      roleId = 5;
      break;

    case "Arquitecto":
      roleId = 6;
      break;
    
    case "Ingeniero Admin":
      roleId = 9
      break;

    case "Analista Admin":
      roleId = 7
      break;
    
    case "Arquitecto Admin":
      roleId = 10;

  }

  bcrypt.hash(process.env.DEFAULT_PASS, saltRounds, (err, hash) => {
    if (err) {
        return res.status(500).json({msj: "Error hashing password", error: true})
    }
    
    pool.query('INSERT INTO usuarios (nombre, apellido1, apellido2, correo_electronico, rol_id, password) VALUES (?, ? ,?, ?, ?, ?)', [userName, lastName1, lastName2, email, roleId, hash] ,(err, results) => {
      try{
          if (err) {
              if (err.code = "ERR_DUP_ENTRY") {
                console.log(err)
                return res.status(400).json({msj: err.message})
              }
          }
          return res.status(200).json(results[0])
      } catch (error){
        console.log(error.code)
          return res.status(400).json(error)
      }
    })
  })
})

app.post('/changeStatus', (req, res) => {
  const {id, activated} = req.body
  const newValue = activated == 0 ? 1 : 0;

  pool.query('UPDATE usuarios SET activated = ? WHERE id = ?', [newValue, id] ,(err, results) => {
    try{
        if (err) {
          return res.status(400).json(err)    
        }
        return res.status(200).json(results)
    } catch (error){
      console.log(error.code)
        return res.status(400).json(error)
    }
  })
})

app.get('/getProjectDetails/:id', (req, res) => {
  const {id} = req.params
  pool.query('call GetProjectInfo(?)', [id], (err, results) => {
      if (err) {
          return res.json(err)
      }
      return res.status(200).json(results)
  })
})

app.get('/getEntidades', (req, res) => {
  pool.query('select * from entidades', (err, results) => {
      if (err) {
          return res.json(err)
      }
      return res.status(200).json(results)
  })
})

app.get('/getBonosSimple', (req, res) => {
  pool.query('select * from tipos_bono', (err, results) => {
      if (err) {
          return res.json(err)
      }
      return res.status(200).json(results)
  })
})

app.post('/updateData/', (req, res) => {
  const { projectData, familyMembers, directionData, formDataAdmin, deletedMembers } = req.body;

  // Validate that there's at least one family member who is the head of the household
  const hasHeadOfHousehold = familyMembers.some(member => member.tipoMiembro == 'Jefe/a de Familia' || member.tipoMiembro == 'jefe/a de familia');
  if (!hasHeadOfHousehold) {
    return res.status(400).json({ message: 'Debe haber al menos un miembro de familia que sea jefe/a de hogar' });
  }

  var newSubtipoSeleccionado = projectData.subtipoSeleccionado

  if (!newSubtipoSeleccionado) {
    newSubtipoSeleccionado = null
  }

  // First, let's check if the variante_bono_id exists
  pool.query('SELECT id FROM variantes_bono WHERE id = ?', [newSubtipoSeleccionado], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Error checking variante_bono_id', error: err.message });
    }
    

    try {
      // Get a connection from the pool for transaction
      pool.getConnection((err, connection) => {
        if (err) {
          console.error('Transaction error:', err);
          return res.status(500).json({ message: 'Error al iniciar la transacción', error: err.message });
        }
        
        // Begin transaction
        connection.beginTransaction((err) => {
          if (err) {
            connection.release();
            console.error('Transaction error:', err);
            return res.status(500).json({ message: 'Error al iniciar la transacción', error: err.message });
          }
          
          // Update propietario
          connection.query('Update propietarios set tipo_propietario_id = ?, cedula = ? where id = ?', 
            [directionData.loteTipoIdentificacion, directionData.loteIdentificacion, directionData.lote_id], 
            (err, propietarioResult) => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  console.error('Propietario insertion error:', err);
                  return res.status(500).json({ message: 'Error al insertar propietario', error: err.message });
                });
              }

              // Update lote
            connection.query('Update lotes set numero_plano_catastro = ?, numero_finca = ?, provincia = ?, distrito = ?, canton = ?, senas_descripcion = ? where id = ?',
            [directionData.numeroPlanoCatastro, directionData.finca, directionData.provincia, directionData.distrito, directionData.canton, directionData.otrasSenas, directionData.lote_id],
            (err, loteResult) => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  console.error('Lote insertion error:', err);
                  res.status(500).json({ message: 'Error al insertar lote', error: err.message });
                });
              }

              // Update proyecto
              const headOfFamily = familyMembers.find(member => member.tipoMiembro == 'Jefe/a de Familia' || member.tipoMiembro == 'jefe/a de familia');
              const projectName = `${headOfFamily.nombre} ${headOfFamily.primerApellido} ${headOfFamily.segundoApellido}`;

              console.log(formDataAdmin)

              connection.query('Update proyectos set nombre = ?, descripcion = ?, grupo_proyecto_id = ?, tipo_bono_id = ?, variante_bono_id = ?, fecha_ingreso = CURDATE(), presupuesto = ?, avaluo = ?, entidad_id = ?, centro_negocio_id = ?, analista_asigna_entidad_id = ?, analista_asigna_ipsum_id = ?, fiscal_id = ?, ingeniero_id = ?, arquitecto_id = ?, promotor_interno_id = ?, codigo_apc = ?, codigo_cfia = ?, fis = ?, constructor_id = ? where id = ?',
                [projectName, 
                  projectData.desc, 
                  projectData.grupoSeleccionado, 
                  projectData.bonoSeleccionado, 
                  newSubtipoSeleccionado,
                  formDataAdmin.presupuesto == "" ? null : formDataAdmin.presupuesto, 
                  formDataAdmin.avaluo == "" ? null : formDataAdmin.avaluo, 
                  formDataAdmin.entidad, 
                  formDataAdmin.entidadSecundaria == "pendiente" ? null : formDataAdmin.entidadSecundaria, 
                  formDataAdmin.analistaEntidad == "pendiente" ? null : formDataAdmin.analistaEntidad, 
                  formDataAdmin.analistaIPSUM, 
                  formDataAdmin.fiscalAsignado == "pendiente" ? null : formDataAdmin.fiscalAsignado, 
                  formDataAdmin.ingenieroAsignado == "pendiente" ? null : formDataAdmin.ingenieroAsignado, 
                  formDataAdmin.arquitecto == "pendiente" ? null : formDataAdmin.arquitecto, 
                  formDataAdmin.Promotor_Ipsum == "pendiente" ? null : formDataAdmin.Promotor_Ipsum, 
                  formDataAdmin.apc, 
                  formDataAdmin.cfia, 
                  projectData.hasFIS, 
                  formDataAdmin.constructor == "pendiente" ? null : formDataAdmin.constructor,
                 projectData.idProyecto],
                (err, proyectoResult) => {
                  if (err) {
                    return connection.rollback(() => {
                      connection.release();
                      console.error('Proyecto insertion error:', err);
                      return res.status(500).json({ message: 'Error al insertar proyecto', error: err.message });
                    });
                  }

                  for (let i = 0; i < familyMembers.length; i++) {
                    console.log(familyMembers[i])

                    if (familyMembers[i].id) {
                      connection.query('Update familias set tipo_miembro = ?, nombre = ?, apellido1 = ?, apellido2 = ?, cedula = ?, tipo_cedula = ?, ingreso = ?, tipo_ingreso = ?, telefono = ?, email = ?, adulto_mayor = ?, discapacidad = ?, imagen_cedula = ? where id = ?',
                        [familyMembers[i].tipoMiembro, 
                        familyMembers[i].nombre, 
                        familyMembers[i].primerApellido, 
                        familyMembers[i].segundoApellido, 
                        familyMembers[i].identificacion, 
                        familyMembers[i].tipoIdentificacion, 
                        familyMembers[i].ingresos == "" ? null : familyMembers[i].ingresos, 
                        familyMembers[i].tipoIngresos == "" ? null : familyMembers[i].tipoIngresos, 
                        familyMembers[i].telefono, 
                        familyMembers[i].email, 
                        familyMembers[i].adultoMayor, 
                        familyMembers[i].discapacidad, 
                        familyMembers[i].cedulaFile ? familyMembers[i].cedulaFile : null, 
                        familyMembers[i].id],
                        (err) => {
                          if (err) {
                            return connection.rollback(() => {
                              connection.release();
                              console.error('Family members insertion error:', err);
                              return res.status(500).json({ message: 'Error al insertar miembros de la familia', error: err.message });
                            });
                          }});
                    } else {
                      connection.query('Insert into familias (proyecto_id, tipo_miembro, nombre, apellido1, apellido2, cedula, tipo_cedula, ingreso, tipo_ingreso, telefono, email, adulto_mayor, discapacidad, imagen_cedula) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [projectData.idProyecto, 
                          familyMembers[i].tipoMiembro, 
                          familyMembers[i].nombre, 
                          familyMembers[i].primerApellido, 
                          familyMembers[i].segundoApellido, 
                          familyMembers[i].identificacion, 
                          familyMembers[i].tipoIdentificacion, 
                          familyMembers[i].ingresos == "" ? null : familyMembers[i].ingresos, 
                          familyMembers[i].tipoIngresos == "" ? null : familyMembers[i].tipoIngresos, 
                          familyMembers[i].telefono, 
                          familyMembers[i].email, 
                          familyMembers[i].adultoMayor, 
                          familyMembers[i].discapacidad, 
                          familyMembers[i].cedulaFile ? familyMembers[i].cedulaFile : null],
                        (err) => {
                          if (err) {
                            return connection.rollback(() => {
                              connection.release();
                              console.error('Family members insertion error:', err);
                              return res.status(500).json({ message: 'Error al insertar miembros de la familia', error: err.message });
                            });
                          }});
                    }
                  }

                  for (let i = 0; i < deletedMembers.length; i++) {
                    connection.query('Delete from familias where id = ?', [deletedMembers[i].id],
                      (err) => {
                        if (err) {
                          return connection.rollback(() => {
                            connection.release();
                            console.error('Family members insertion error:', err);
                            res.status(500).json({ message: 'Error al insertar miembros de la familia', error: err.message });
                          });
                        }});
                  }

                  connection.commit(err => {
                    if (err) {
                      return connection.rollback(() => {
                        connection.release();
                        console.error('Commit error:', err);
                        res.status(500).json({ message: 'Error al finalizar la transacción', error: err.message });
                      });
                    }
                    connection.release();
                    console.log("Proyecto guardado exitosamente")
                    res.status(200).json({ message: 'Proyecto guardado exitosamente' });
                  });
                }
              );
            }
          );
          });
        })});
        
      
    }catch (err) {
        console.log(err)
    }
  });
});

app.get('/getEtapas', (req, res) => {
  pool.query('call getEtapas()', (err, results) => {
      if (err) {
          return res.json(err)
      }
      return res.status(200).json(results)
  })
})

app.post('/updateEtapa', (req, res) => {
  const {id, etapa, subetapa} = req.body
  
  const subetapaFixed = subetapa == 0 ? null : subetapa

  pool.query('update proyectos set etapa_actual_id = ?, subetapa_actual_id = ? where id = ?', [etapa, subetapaFixed, id], (err, results) => {
      if (err) {
        console.log(err)
          return res.json(err)
      }
      return res.status(200).json(results)
  })
})

app.post('/insertBitacora', (req, res) => {
  const {descripcion, color, usuario, proyecto, time, tipo} = req.body
  var newDate = new Date(time)

  pool.query('insert into entradas_bitacora (descripcion, color, usuario_id, proyecto_id, fecha_ingreso, tipo) values (?, ? ,?, ?, ?, ?)', [descripcion, color, usuario, proyecto, newDate, tipo], (err, results) => {
      if (err) {
        console.log(err)
          return res.json(err)
      }

      pool.query('update proyectos set estado_color = ? where id = ?', [color, proyecto], (err, results) => {
        if (err) {
          console.log(err)
            return res.json(err)
        }
        return res.status(200).json(results)
      })
  })
})

app.post('/insertData', (req, res) => {
  const {tabla} = req.body
  const claves = [];
  const valores = [];
  
  for (const [clave, valor] of Object.entries(req.body)) {
    if (clave !== 'tabla') {
      claves.push(clave);
      valores.push(valor);
    }
  }

  const clavesConBackticks = claves.map(clave => `\`${clave}\``);

  pool.query('insert into ?? (??) values (?)', [tabla,claves, valores], (err, results) => {
      if (err) {
        console.log(err)
          return res.json(err)
      }
      return res.status(200).json(results)
  })
})

app.get('/getGenerics', (req, res) => {
  const query = req.query;
  const table = query.table

  pool.query('select * from ??', [table], (err, results) => {
      if (err) {
          return res.json(err)
      }
      return res.status(200).json(results)
  })
})

app.post('/genericUpdate', (req, res) => {
  const {table, dataEdit} = req.body
  const claves = [];
  const valores = [];

  for (const [clave, valor] of Object.entries(dataEdit)) {
      claves.push(clave);
      valores.push(valor);
  }

  let i;
  for (i = 0; i < claves.length; i++) {
    if (claves[i] !== "id") {
      pool.query('Update ?? set ?? = ? where id = ?', [table ,claves[i], valores[i], dataEdit.id ], (err, results) => {
        if (err) {
          console.log(err)
            return res.json(err)
        }
      })
    }
  }
  return res.status(200).json({msj: "Actualizado correctamente"})
})

app.post('/updateStatusGenerics', (req, res) => {
  const {id, activated, table} = req.body
  const newValue = activated == 0 ? 1 : 0;

  pool.query('UPDATE ?? SET activated = ? WHERE id = ?', [table, newValue, id] ,(err, results) => {
    try{
        if (err) {
          return res.status(400).json(err)    
        }
        return res.status(200).json(results)
    } catch (error){
      console.log(error.code)
        return res.status(400).json(error)
    }
  })
})

app.get('/getGrupos', (req, res) => {
  pool.query('select * from grupos_proyectos', (err, results) => {
      if (err) {
          return res.json(err)
      }
      return res.status(200).json(results)
  })
})

app.post('/deleteProyecto', (req, res) => {
  const {id, currentStatus} = req.body
  let newStatus = currentStatus == 1 ? 0 : 1

  pool.query('UPDATE proyectos SET activated = ? WHERE id = ?', [newStatus, id] ,(err, results) => {
    try{
        if (err) {
          return res.status(400).json(err)    
        }
        return res.status(200).json(results)
    } catch (error){
      console.log(error.code)
        return res.status(400).json(error)
    }
  })
})

app.get('/getEmails', (req, res) => {
  const query = req.query;
  const emails = query.emails.split(",")
  const idProyecto = query.id_proyecto

  pool.query('select ?? from proyectos where id in (?)',[emails, idProyecto], (err, results) => {
      if (err) {
          console.log(err)
          return res.json(err)
      }
      let ids = []

      for (const [clave, valor] of Object.entries(results[0])) {
          ids.push(valor);
      }

      ids.push(1)
      console.log(ids)
      
      pool.query('select correo_electronico from usuarios where id in (?)',[ids], (err, results) => {
        if (err) {
            console.log(err)
            return res.json(err)
        }
        
        return res.status(200).json({emails: results, ids})
      })
  })
})

app.post('/forgetPassword', (req, res) => {
  const body = req.body;
  const email = body.email

  pool.query('select * from usuarios where correo_electronico = ?',[email], async (err, results) => {
      if (err) {
          return res.json(err)
      }

      if (results.length == 0) {
        res.status(200).json({noUser: true, results: results})
      } else {
        try {
          const newPassword = generatePassword.generate({
            length: 10,
            numbers: true
          })
  
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: process.env.EMAIL_USER, // Tu correo de Gmail
              pass: process.env.EMAIL_PASS  // Tu contraseña de aplicación de Gmail
            }
          });
  
          const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email, // Convertir array de destinatarios a string
            subject: "Recuperacion de contraseña",
            html: `<p>Su nueva contraseña temporal es ${newPassword}, por favor iniciar sesión y cambiar a una nueva contraseña</p>` // Puedes usar HTML en el contenido
          };
      
          // Enviar el correo
          const info = await transporter.sendMail(mailOptions);

          bcrypt.hash(newPassword, saltRounds, (err, hash) => {
            if (err) {
              return res.status(500).json({ msj: "Error hashing password", error: true });
            }

            pool.query('Update usuarios set password = ?, estado = 0 where correo_electronico = ?',[hash, email], (err, results) => {
              if (err) {
                console.log(err)
                  return res.json(err)
              }
              return res.status(200).json(results)
            })
          })
        } catch (error) {
          console.log(error)
        }
      }
  })
})

app.post('/pushPrueba', (req, res) => {
  const body = req.body;
  const token = body.token

  pool.query('insert into tokenTest (token) values (?)',[token], (err, results) => {
      if (err) {
          return res.json(err)
      }
      return res.status(200).json(results)
  })
})

app.get('/getNotisLeidas', (req, res) => {
  const query = req.query;
  const user_id = query.user_id

  pool.query('select * from notificaciones where usuario_id = ? and leido = 0 order by fecha_ingreso desc', [user_id], (err, results) => {
      if (err) {
          return res.json(err)
      }
      return res.status(200).json(results)
  })
})

app.get('/getAllNotis', (req, res) => {
  const query = req.query;
  const user_id = query.user_id

  pool.query('select * from notificaciones where usuario_id = ? order by fecha_ingreso desc', [user_id], (err, results) => {
      if (err) {
        console.log(err)
          return res.json(err)
      }
      console.log(results)
      return res.status(200).json(results)
  })
})

app.post('/setReaded', (req, res) => {
  const body = req.body;
  const id = body.id;

  pool.query('update notificaciones set leido = 1 where id= ? ', [id], (err, results) => {
      if (err) {
          return res.json(err)
      }
      return res.status(200).json(results)
  })
})

app.post('/setAllReaded', (req, res) => {
  const body = req.body;
  const id = body.id;

  pool.query('update notificaciones set leido = 1 where usuario_id= ? ', [id], (err, results) => {
      if (err) {
          return res.json(err)
      }
      return res.status(200).json(results)
  })
})

app.post('/deleteReaded', (req, res) => {
  const body = req.body;
  const id = body.id;

  pool.query('delete from notificaciones where usuario_id= ? and leido = 1 ', [id], (err, results) => {
      if (err) {
          return res.json(err)
      }
      return res.status(200).json(results)
  })
})

app.post('/insertNoti', (req, res) => {
  const body = req.body;
  const user_id = body.user_id;
  const message = body.message;
  const time = body.time
  var newDate = new Date(time)
  console.log("BBBBBBBBBBBBBBBBBB")

  pool.query('Insert into notificaciones(message, usuario_id, fecha_ingreso) values (?, ?, ?)', [message, user_id, newDate], (err, results) => {
      if (err) {
        console.error(err)
          return res.json(err)
      }
      console.log("AAAAAAAAAAAAAAAAAAAAA")
      console.log(results)
      return res.status(200).json(results)
  })
})

// Use the PORT environment variable if available, otherwise use 3001
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Legacy server listening on port ${PORT}...`);
})

module.exports = app;