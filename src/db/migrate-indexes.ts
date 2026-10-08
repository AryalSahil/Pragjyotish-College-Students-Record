import pkg from "pg";
const { Pool } = pkg;
import * as dotenv from "dotenv";

dotenv.config();

async function runMigration() {
  console.log("Starting index definition migration...");
  const pool = new Pool({
    host: process.env.SQL_HOST,
    user: process.env.SQL_ADMIN_USER || process.env.SQL_USER,
    password: process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
    max: 1,
  });

  const client = await pool.connect();
  try {
    console.log("Defining index for students(registration_id)...");
    await client.query(`CREATE INDEX IF NOT EXISTS students_reg_idx ON students (registration_id);`);
    
    console.log("Defining index for students(form_number)...");
    await client.query(`CREATE INDEX IF NOT EXISTS students_form_idx ON students (form_number);`);

    console.log("Defining index for students(name)...");
    await client.query(`CREATE INDEX IF NOT EXISTS students_name_idx ON students (name);`);

    console.log("Database migration completed successfully. All indexes defined.");
  } catch (err) {
    console.error("Migration failed:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch((err) => {
  console.error(err);
  process.exit(1);
});
