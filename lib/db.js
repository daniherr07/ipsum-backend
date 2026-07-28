var mysql = require("mysql2/promise");
require("dotenv").config();
try {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DEFAULT,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  // Los valores de insert/update siempre van parametrizados (placeholders
  // "?"), pero las LLAVES (nombres de columna) se interpolan directo en el
  // SQL — varias rutas reenvían req.body casi tal cual como "data", así que
  // una key maliciosa (ej. `` `nombre\` = (SELECT password FROM usuarios) -- ` ``)
  // sería inyección SQL igual que si fuera un valor. Esto no reemplaza tener
  // un allowlist de columnas por tabla (más estricto), pero cierra la vía de
  // inyección: solo se permiten identificadores de columna normales.
  const COLUMN_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

  function assertValidColumns(keys) {
    const invalid = keys.filter((key) => !COLUMN_NAME_PATTERN.test(key));
    if (invalid.length > 0) {
      throw new Error(`Nombre de columna inválido: ${invalid.join(", ")}`);
    }
  }

  class Database {
    constructor(pool) {
      this.pool = pool;
    }

    async query(sql, params = []) {
      const [rows] = await this.pool.execute(sql, params);
      return rows;
    }

    select(table, params = { values: "*", where: "", params: [] }) {
      const sql = `SELECT ${params.values} FROM ${table} ${params.where ? `WHERE ${params.where}` : ""}`;
      return this.query(sql, params.params);
    }

    insert(table, data = {}) {
      const keys = Object.keys(data);
      assertValidColumns(keys);
      const values = Object.values(data);
      const placeholders = keys.map(() => "?").join(", ");

      const sql = `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`;
      return this.query(sql, values);
    }

    update(table, data = {}, where = "", params = []) {
      const keys = Object.keys(data);
      assertValidColumns(keys);
      const values = Object.values(data);

      const setClause = keys.map((key) => `${key} = ?`).join(", ");

      const sql = `UPDATE ${table} SET ${setClause} ${where ? `WHERE ${where}` : ""}`;
      return this.query(sql, [...values, ...params]);
    }

    delete(table, where = "", params = []) {
      const sql = `DELETE FROM ${table} ${where ? `WHERE ${where}` : ""}`;
      return this.query(sql, params);
    }

    async checkHealth() {
      try {
        await this.pool.query("SELECT 1");
        return true;
      } catch (error) {
        console.error("DB health check failed", error);
        return false;
      }
    }
  }

  module.exports = new Database(pool);
} catch (error) {
  throw new Error(error);
}
