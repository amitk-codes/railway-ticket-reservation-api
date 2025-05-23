const { execSync } = require('child_process');
require('dotenv').config();


/**
 * Sets up the database for the application
 */
function setupDatabase() {
  try {
    console.log('Setting up database...');
    
    // Check if PostgreSQL is installed
    try {
      execSync('psql --version', { stdio: 'ignore' });
    } catch (error) {
      console.error('PostgreSQL is not installed or not in PATH. Please install PostgreSQL first.');
      process.exit(1);
    }
    
    const {
      DB_HOST = 'localhost',
      DB_PORT = 5432,
      DB_USER = 'postgres',
      DB_PASSWORD = 'postgres',
      DB_NAME = 'railway_reservation'
    } = process.env;
    
    // Create database if it doesn't exist
    const createDbCommand = `PGPASSWORD=${DB_PASSWORD} psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -c "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1 || PGPASSWORD=${DB_PASSWORD} psql -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -c "CREATE DATABASE ${DB_NAME}"`;
    
    try {
      execSync(createDbCommand, { stdio: 'inherit' });
      console.log(`Database '${DB_NAME}' checked/created successfully.`);
    } catch (error) {
      console.error('Error creating database:', error.message);
      process.exit(1);
    }
    
    console.log('Running database setup script...');
    
    // Import and run the setup function
    require('../db/prepare');
    
    console.log('Database setup completed successfully.');
  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  }
}

// Run the setup if this file is executed directly
if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase; 