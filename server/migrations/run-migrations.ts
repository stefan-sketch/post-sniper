import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from '../db';

async function runMigrations() {
  try {
    console.log('[Migrations] Starting database migrations...');
    
    // Read the SQL file
    const sqlPath = join(__dirname, 'add_performance_indexes.sql');
    const sql = readFileSync(sqlPath, 'utf-8');
    
    // Split by semicolon and filter out empty statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('SHOW'));
    
    // Execute each statement
    for (const statement of statements) {
      try {
        await pool.query(statement);
        console.log('[Migrations] ✓ Executed:', statement.substring(0, 60) + '...');
      } catch (error: any) {
        // Ignore "already exists" errors
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log('[Migrations] ⊘ Index already exists, skipping');
        } else {
          throw error;
        }
      }
    }
    
    console.log('[Migrations] ✓ All migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('[Migrations] ✗ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();

