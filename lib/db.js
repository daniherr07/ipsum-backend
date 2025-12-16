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

  class Database {
    constructor(pool) {
      this.pool = pool;
    }

    async query(sql, params = []) {
      const [rows] = await this.pool.execute(sql, params);
      return rows;
    }

    select(table, { values = "*", where = "", params = [] }) {
      const sql = `SELECT ${values} FROM ${table} ${where ? `WHERE ${where}` : ""}`;
      return this.query(sql, params);
    }

    insert(table, data = {}) {
      const keys = Object.keys(data);
      const values = Object.values(data);
      const placeholders = keys.map(() => "?").join(", ");

      const sql = `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`;
      return this.query(sql, values);
    }

    update(table, data = {}, where = "", params = []) {
      const keys = Object.keys(data);
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
      
    }
  }

  module.exports = new Database(pool);
} catch (error) {
  throw new Error(error);
}
