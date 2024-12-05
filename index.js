const express = require('express')
const app = express()
const cors = require('cors')
const bodyParser = require('body-parser');


app.use(cors())
app.use(bodyParser.json());
app.use(express.json())


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
            return res.json(err)
        }
        return res.status(200).json(results[0])
    })
})


app.get('/projectNames', (req, res) => {
    con.query('select * from proyectos' ,(err, results) => {
        if (err) {
            return res.json(err)
        }
        return res.status(200).json(results)
    })
})

app.get('/getData/:name', (req, res) => {
    const {name} = req.params
    con.query('Call prueba(?)', [name] ,(err, results) => {
        if (err) {
            return res.json(err)
        }
        return res.status(200).json(results[0])
    })
})

app.get('/getUsers', (req, res) => {
  con.query('call getAllUsers()',(err, results) => {
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

    con.query('call getUserWithRole(?)', [user] ,(err, results) => {
        try{
            if (err) {
                return res.status(400).json(err)
            }



            if(results.length == 0){
                return res.status(400).json({msj: "not users found"})
            }

            if (results[0][0].activated == 0) {
              return res.status(400).json({msj: "not users found", activated:false})
            }

            console.log(results[0][0])

            if (results[0][0].password == psw) {
                if (results[0][0].estado == 0) {
                  console.log("Usuario nuevo")
                    return res.status(200).json({msj: "Usuario autorizado", authorized: true, newUser: true, rol: results[0][0].role_name})
                } else{
                    console.log("Usuario viejo")
                    return res.status(200).json({msj: "Usuario autorizado", authorized: true, newUser: false, rol: results[0][0].role_name, user: results[0][0].user_name} )
                }
            } else{
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

            if(results.length == 0){
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

app.get('/getBonos', (req, res) => {
    con.query('Call getBonos()', (err, results) => {
        if (err) {
            return res.json(err)
        }
        const data = organizeBonos(results[0])
        return res.status(200).json(data)
    })
})

  
app.get('/getAdminData/', (req, res) => {
    con.query('Call ObtenerNombresRelevantes()', (err, results) => {
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
      Promotor_de_Entidades: [],
      Analista_Ipsum: [], // Add the new type here
      Ingeniero: [],
      Entidad: [],
      Promotor_Ipsum: []
    };
  
    // First pass: organize by type and collect entities
    data.forEach(item => {
      if (item.Tipo === 'Entidad') {
        const entityData = {
          localId: item.localID,  
          Tipo: item.Tipo,
          Nombre: item.Entidad,
          Centros_de_Negocio: []
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
          const itemData = {localId: item.localID, nombre: item.Centro_de_Negocio}
          entity.Centros_de_Negocio.push(itemData);
        }
      }
    });
  
    return organizedData;
  }

function organizeBonos(data){
    const result = Object.values(
        data.reduce((acc, { TipoBonoID, TipoBonoNombre, VarianteID, VarianteNombre }) => {
          // Si el TipoBonoID no existe aún en el acumulador, lo inicializamos
          if (!acc[TipoBonoID]) {
            acc[TipoBonoID] = {
              id: TipoBonoID,
              nombre: TipoBonoNombre,
              subtipos: []
            };
          }
      
          // Si la variante no es null, la añadimos al array de subtipos
          if (VarianteID && VarianteNombre) {
            acc[TipoBonoID].subtipos.push({ id: VarianteID, nombre: VarianteNombre });
          }
      
          return acc;
        }, {})
      );
    return result
}

app.post('/saveData/', (req, res) => {
    const { projectData, familyMembers, directionData, formDataAdmin } = req.body;

    console.log(
      projectData,
      familyMembers,
      directionData,
      formDataAdmin
    )
  
    // Validate that there's at least one family member who is the head of the household
    const hasHeadOfHousehold = familyMembers.some(member => member.tipo === 'Jefe/a de Familia');
    if (!hasHeadOfHousehold) {
      return res.status(400).json({ message: 'Debe haber al menos un miembro de familia que sea jefe/a de hogar' });
    }

    const newSubtipoSeleccionado = projectData.subtipoSeleccionado + 1
  
    if (!newSubtipoSeleccionado) {
        console.log("error 1")
      return res.status(400).json({ message: 'variante_bono_id is required' });
    }
  
    // First, let's check if the variante_bono_id exists
    con.query('SELECT id FROM variantes_bono WHERE id = ?', [newSubtipoSeleccionado], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Error checking variante_bono_id', error: err.message });
      }
      
      if (results.length === 0) {
        console.log("Error2")
        return res.status(400).json({ message: 'Invalid variante_bono_id. Please select a valid option.' });
      }


      try {
        
      
  
      // If we reach here, the variante_bono_id is valid, so we can proceed with the insertion
      con.beginTransaction(err => {
        if (err) {
          console.error('Transaction error:', err);
          return res.status(500).json({ message: 'Error al iniciar la transacción', error: err.message });
        }
  
        // Insert propietario
        con.query('INSERT INTO propietarios (tipo_propietario_id, cedula) VALUES (?, ?)', 
          [directionData.loteTipoIdentificacion, directionData.loteIdentificacion], 
          (err, propietarioResult) => {
            if (err) {
              return con.rollback(() => {
                console.error('Propietario insertion error:', err);
                res.status(500).json({ message: 'Error al insertar propietario', error: err.message });
              });
            }
  
            const propietarioId = propietarioResult.insertId;
  
            // Insert lote
            con.query('INSERT INTO lotes (propietario_id, numero_plano_catastro, numero_finca, provincia, distrito, canton, senas_descripcion) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [propietarioId, directionData.numeroPlanoCatastro, directionData.finca, directionData.provincia, directionData.distrito, directionData.canton, directionData.otrasSenas],
              (err, loteResult) => {
                if (err) {
                  return con.rollback(() => {
                    console.error('Lote insertion error:', err);
                    res.status(500).json({ message: 'Error al insertar lote', error: err.message });
                  });
                }
  
                const loteId = loteResult.insertId;
  
                // Insert proyecto
                const headOfFamily = familyMembers.find(member => member.tipo === 'Jefe/a de Familia');
                const projectName = `${headOfFamily.nombre} ${headOfFamily.apellido1} ${headOfFamily.apellido2}`;
  
                con.query('INSERT INTO proyectos (nombre, descripcion, grupo_proyecto_id, tipo_bono_id, variante_bono_id, lote_id, fecha_ingreso, presupuesto, avaluo, entidad_id, centro_negocio_id, analista_asigna_entidad_id, analista_asigna_ipsum_id, fiscal_id, ingeniero_id, promotor_externo_id, promotor_interno_id, codigo_apc, codigo_cfia, fis) VALUES (?, ?, ?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                  [projectName, projectData.desc, projectData.grupoSeleccionado, projectData.bonoSeleccionado, 
                   newSubtipoSeleccionado, loteId, formDataAdmin.presupuesto, formDataAdmin.avaluo, 
                   formDataAdmin.entidad, formDataAdmin.entidadSecundaria, formDataAdmin.analistaEntidad, 
                   formDataAdmin.analistaIPSUM, formDataAdmin.fiscalAsignado, formDataAdmin.ingenieroAsignado, 
                   formDataAdmin.promotorEntidad, formDataAdmin.Promotor_Ipsum, formDataAdmin.apc, 
                   formDataAdmin.cfia, projectData.hasFIS],
                  (err, proyectoResult) => {
                    if (err) {
                      return con.rollback(() => {
                        console.error('Proyecto insertion error:', err);
                        res.status(500).json({ message: 'Error al insertar proyecto', error: err.message });
                      });
                    }
  
                    const proyectoId = proyectoResult.insertId;
                    console.log(familyMembers)
  
                    // Insert family members
                    const familyValues = familyMembers.map(member => [
                      proyectoId, 
                      member.tipo || null, 
                      member.nombre || null, 
                      member.apellido1 || null, 
                      member.apellido2 || null,
                      member.identificacion || null, 
                      member.tipoIdentificacion || null, 
                      member.ingresos || null, 
                      member.tipoIngresos || null,
                      member.telefono || null, 
                      member.tipoTelefono || null, 
                      member.email || null, 
                      member.adultoMayor || false, 
                      member.discapacidad || false
                    ]);
  
                    con.query('INSERT INTO familias (proyecto_id, tipo_miembro, nombre, apellido1, apellido2, cedula, tipo_cedula, ingreso, tipo_ingreso, telefono, tipo_telefono, email, adulto_mayor, discapacidad) VALUES ?',
                      [familyValues],
                      (err) => {
                        if (err) {
                          return con.rollback(() => {
                            console.error('Family members insertion error:', err);
                            res.status(500).json({ message: 'Error al insertar miembros de la familia', error: err.message });
                          });
                        }
  
                        con.commit(err => {
                          if (err) {
                            return con.rollback(() => {
                              console.error('Commit error:', err);
                              res.status(500).json({ message: 'Error al finalizar la transacción', error: err.message });
                            });
                          }
                          res.status(200).json({ message: 'Proyecto guardado exitosamente', proyectoId });
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

      } catch (err) {
          console.log(err)
      }
    });
  });
  

app.post('/updateUser', (req, res) => {
  const {id, lastName1, lastName2, userName, roles} = req.body

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

    default:
      break;
  }

  con.query('UPDATE usuarios SET nombre = ?, apellido1 = ?, apellido2 = ?, rol_id = ? WHERE id = ?', [userName, lastName1, lastName2, roleId, id] ,(err, results) => {
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

    default:
      break;
  }

  con.query('INSERT INTO usuarios (nombre, apellido1, apellido2, correo_electronico, rol_id) VALUES (?, ? ,?, ?, ?)', [userName, lastName1, lastName2, email, roleId] ,(err, results) => {
    try{
        if (err) {

            if (err.code = "ERR_DUP_ENTRY") {
              console.log(err)
              return res.status(400).json({msj: err.message})
              
            }
            return res.status(400).json(err)
            
        }
        return res.status(200).json(results[0])
    } catch (error){
      console.log(error.code)
        return res.status(400).json(error)
        
    }
  })
})

app.post('/changeStatus', (req, res) => {
  const {id, activated} = req.body
  const newValue = activated == 0 ? 1 : 0;

  con.query('UPDATE usuarios SET activated = ? WHERE id = ?', [newValue, id] ,(err, results) => {
    try{
        if (err) {
          return res.status(400).json(err)    
        }
        return res.status(200).json(results[0])
    } catch (error){
      console.log(error.code)
        return res.status(400).json(error)
        
    }
  })
})


app.listen(3001, () => {
})

module.exports = app;