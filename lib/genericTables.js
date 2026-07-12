// Tablas "genéricas" (catálogos) que las rutas /generics, /insertGenerics y
// /updateGenerics tienen permitido leer/escribir. El nombre de tabla llega
// desde el cliente (params o body) y lib/db.js lo interpola directo en el
// SQL, así que hay que validarlo contra esta lista antes de usarlo — sin
// esta validación, cualquiera podría pasar el nombre de una tabla que no
// debería tocar (usuarios, proyectos_new, etc.) o texto SQL arbitrario.
const ALLOWED_GENERIC_TABLES = [
  "analistas_entidades",
  "centros_negocios",
  "constructores",
  "entidades",
  "fiscales",
  "promotores_ipsum",
  "grupos_proyectos",
  "tipos_bono",
  "variantes_bono",
  // Estas dos son de solo lectura en la práctica: ningún formulario del
  // frontend las administra vía insertGenerics/updateGenerics (no están en
  // app/const.js modifyData), pero se necesitan en /generics/:table para
  // reemplazar listas que antes estaban hardcodeadas en el frontend.
  "etapas",
  "tipos_propietario",
];

module.exports = ALLOWED_GENERIC_TABLES;
