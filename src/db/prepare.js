const pool = require('../config/db');
const { BERTH_TYPES, TICKET_STATUS } = require('../constants/reservationLimits');

/**
 * Creates all required database tables for the railway reservation system
 */
async function prepareDatabase() {
  const client = await pool.connect();
  
  try {
    // Begin transaction
    await client.query('BEGIN');
    
    // Create enum types
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'berth_type') THEN
          CREATE TYPE berth_type AS ENUM (
            '${BERTH_TYPES.LOWER}', 
            '${BERTH_TYPES.MIDDLE}', 
            '${BERTH_TYPES.UPPER}', 
            '${BERTH_TYPES.SIDE_LOWER}'
          );
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_status') THEN
          CREATE TYPE ticket_status AS ENUM (
            '${TICKET_STATUS.CONFIRMED}', 
            '${TICKET_STATUS.RAC}', 
            '${TICKET_STATUS.WAITING_LIST}'
          );
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_type') THEN
          CREATE TYPE gender_type AS ENUM ('MALE', 'FEMALE', 'OTHER');
        END IF;
      END $$;
    `);
    
    // Create berths table
    await client.query(`
      CREATE TABLE IF NOT EXISTS berths (
        id SERIAL PRIMARY KEY,
        berth_number INTEGER NOT NULL,
        berth_type berth_type NOT NULL,
        is_allocated BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(berth_number)
      );
    `);
    
    // Create passengers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS passengers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        age INTEGER NOT NULL,
        gender gender_type NOT NULL,
        has_child_under_five BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create tickets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        pnr VARCHAR(10) UNIQUE NOT NULL,
        passenger_id INTEGER REFERENCES passengers(id),
        berth_id INTEGER REFERENCES berths(id),
        status ticket_status NOT NULL,
        waiting_list_number INTEGER,
        rac_number INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create children table (for children under 5 who don't get berths)
    await client.query(`
      CREATE TABLE IF NOT EXISTS children (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        age INTEGER NOT NULL,
        gender gender_type NOT NULL,
        parent_passenger_id INTEGER REFERENCES passengers(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create counter table to track available berths, RAC, and waiting list
    await client.query(`
      CREATE TABLE IF NOT EXISTS counters (
        id SERIAL PRIMARY KEY,
        available_confirmed_berths INTEGER NOT NULL DEFAULT 63,
        available_rac_berths INTEGER NOT NULL DEFAULT 18,
        available_waiting_list INTEGER NOT NULL DEFAULT 10,
        current_waiting_list_number INTEGER NOT NULL DEFAULT 0,
        current_rac_number INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Initialize the berths with berth numbers and types
    const berthTypes = [
      // 21 sets of lower, middle, upper (63 berths)
      ...[...Array(21)].flatMap((_, i) => [
        { berth_number: i * 3 + 1, berth_type: BERTH_TYPES.LOWER },
        { berth_number: i * 3 + 2, berth_type: BERTH_TYPES.MIDDLE },
        { berth_number: i * 3 + 3, berth_type: BERTH_TYPES.UPPER }
      ]),
      
      // 9 side-lower berths (for RAC)
      ...[...Array(9)].map((_, i) => ({ 
        berth_number: 64 + i, 
        berth_type: BERTH_TYPES.SIDE_LOWER 
      }))
    ];
    
    // Insert berths
    for (const berth of berthTypes) {
      await client.query(`
        INSERT INTO berths (berth_number, berth_type)
        VALUES ($1, $2)
        ON CONFLICT (berth_number) DO NOTHING;
      `, [berth.berth_number, berth.berth_type]);
    }
    
    // Initialize counter
    await client.query(`
      INSERT INTO counters (
        available_confirmed_berths, 
        available_rac_berths, 
        available_waiting_list
      )
      VALUES (63, 18, 10)
      ON CONFLICT DO NOTHING;
    `);
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('Database setup completed successfully');
  } catch (err) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('Error setting up database:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Run the setup function
prepareDatabase().then(() => {
  console.log('Setup script execution completed');
  process.exit(0);
}).catch(err => {
  console.error('Setup script failed:', err);
  process.exit(1);
}); 