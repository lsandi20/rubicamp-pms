require('dotenv').config();
const { Pool } = require('pg');

let db;
if (process.env.NODE_ENV === 'development') {
  db = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT,
  })
} else if (process.env.NODE_ENV === 'production') {

  db = new Pool({
    connectionString: process.env.DATABASE_URL
  })
}


module.exports = db;