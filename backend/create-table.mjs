import sql from 'mssql';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

async function createTable() {
  try {
    console.log('Connecting to Azure SQL...');
    const pool = await sql.connect(config);
    
    const sqlScript = readFileSync('./create-animal-scores-table.sql', 'utf-8');
    
    // Split by GO statements
    const statements = sqlScript.split(/\bGO\b/i).filter(s => s.trim());
    
    console.log(`Executing ${statements.length} SQL statements...`);
    
    for (const statement of statements) {
      if (statement.trim()) {
        await pool.request().query(statement);
      }
    }
    
    console.log('✅ animal_scores table created successfully!');
    
    await pool.close();
  } catch (error) {
    console.error('❌ Error creating table:', error.message);
    process.exit(1);
  }
}

createTable();
