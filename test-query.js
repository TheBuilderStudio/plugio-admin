const mysql = require("mysql2/promise");
require("dotenv").config({ path: ".env.local" });

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "3306", 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
  });

  try {
    const limit = 10;
    const [rows] = await pool.execute(
      `
      (
        SELECT id, name, email, created_at AS occurred_at, 'registered' AS action
        FROM users
        ORDER BY created_at DESC
        LIMIT ?
      )
      UNION ALL
      (
        SELECT id, name, email, beta_application_submitted_at AS occurred_at, 'applied' AS action
        FROM users
        WHERE beta_application_submitted_at IS NOT NULL
        ORDER BY beta_application_submitted_at DESC
        LIMIT ?
      )
      ORDER BY occurred_at DESC
      LIMIT ?
    `,
      [limit, limit, limit]
    );
    console.log("Success:", rows.length);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}
run();
