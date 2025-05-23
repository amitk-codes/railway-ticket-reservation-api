const pool = require('../../config/db');
const { v4: uuidv4 } = require('uuid');
const { TICKET_STATUS, MAX_RAC_TICKETS, MAX_WAITING_LIST } = require('../../constants/reservationLimits');

/**
 * Base Ticket class with core operations
 */
class BaseTicket {
  /**
   * Generate a unique PNR (Passenger Name Record) number using UUID
   * @returns {string} - 10-character PNR based on UUID with better uniqueness
   */
  static generatePNR() {
    // Use timestamp + random UUID portion for better uniqueness
    const uuid = uuidv4().replace(/-/g, '');
    const timestamp = Date.now().toString(36); // Base36 timestamp
    
    // Combine timestamp (last 4 chars) + UUID (first 6 chars) for 10 total
    return (timestamp.slice(-4) + uuid.substring(0, 6)).toUpperCase();
  }

  /**
   * Create a new ticket
   * @param {Object} ticketData - Ticket data
   * @param {number} ticketData.passenger_id - Passenger ID
   * @param {number|null} ticketData.berth_id - Berth ID (null for waiting list)
   * @param {string} ticketData.status - Ticket status (CONFIRMED, RAC, WAITING_LIST)
   * @param {number|null} ticketData.waiting_list_number - Waiting list number
   * @param {number|null} ticketData.rac_number - RAC number
   * @param {Object} client - PostgreSQL client for transaction
   * @returns {Promise<Object>} - Created ticket data
   */
  static async create(ticketData, client) {
    const { 
      passenger_id, 
      berth_id = null, 
      status, 
      waiting_list_number = null, 
      rac_number = null 
    } = ticketData;
    
    const pnr = this.generatePNR();
    
    const query = `
      INSERT INTO tickets (pnr, passenger_id, berth_id, status, waiting_list_number, rac_number)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    
    const result = await client.query(query, [
      pnr, passenger_id, berth_id, status, waiting_list_number, rac_number
    ]);
    
    return result.rows[0];
  }

  /**
   * Get ticket details by PNR
   * @param {string} pnr - PNR number
   * @returns {Promise<Object>} - Ticket details with passenger and berth information
   */
  static async getByPNR(pnr) {
    const query = `
      SELECT 
        t.id, t.pnr, t.status, t.waiting_list_number, t.rac_number,
        p.name, p.age, p.gender, p.has_child_under_five,
        b.berth_number, b.berth_type,
        c.id as child_id, c.name as child_name, c.age as child_age, c.gender as child_gender
      FROM tickets t
      JOIN passengers p ON t.passenger_id = p.id
      LEFT JOIN berths b ON t.berth_id = b.id
      LEFT JOIN children c ON p.id = c.parent_passenger_id
      WHERE t.pnr = $1;
    `;
    
    const result = await pool.query(query, [pnr]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    // Group children with their parents
    const ticket = result.rows[0];
    const children = [];
    
    result.rows.forEach(row => {
      if (row.child_id) {
        children.push({
          id: row.child_id,
          name: row.child_name,
          age: row.child_age,
          gender: row.child_gender
        });
      }
    });
    
    // Remove child fields from the main ticket object
    delete ticket.child_id;
    delete ticket.child_name;
    delete ticket.child_age;
    delete ticket.child_gender;
    
    // Add children array
    ticket.children = children;
    
    return ticket;
  }

  /**
   * Mark a berth as allocated
   * @param {number} berthId - Berth ID
   * @param {Object} client - PostgreSQL client for transaction
   * @returns {Promise<void>}
   */
  static async allocateBerth(berthId, client) {
    const query = `
      UPDATE berths
      SET is_allocated = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1;
    `;
    
    await client.query(query, [berthId]);
  }

  /**
   * Update the counter table for available seats
   * @param {string} ticketStatus - CONFIRMED, RAC, or WAITING_LIST
   * @param {number} change - Amount to change (-1 for booking, +1 for cancellation)
   * @param {Object} client - PostgreSQL client for transaction
   * @returns {Promise<Object>} - Updated counter values
   */
  static async updateCounters(ticketStatus, change, client) {
    let updateColumn = '';
    
    switch (ticketStatus) {
      case TICKET_STATUS.CONFIRMED:
        updateColumn = 'available_confirmed_berths';
        break;
      case TICKET_STATUS.RAC:
        updateColumn = 'available_rac_berths';
        break;
      case TICKET_STATUS.WAITING_LIST:
        updateColumn = 'available_waiting_list';
        break;
      default:
        throw new Error('Invalid ticket status');
    }
    
    // For increment of waiting list or RAC numbers
    let incrementColumn = '';
    if (ticketStatus === TICKET_STATUS.WAITING_LIST && change < 0) {
      incrementColumn = 'current_waiting_list_number';
    } else if (ticketStatus === TICKET_STATUS.RAC && change < 0) {
      incrementColumn = 'current_rac_number';
    }
    
    let query = `
      UPDATE counters
      SET ${updateColumn} = ${updateColumn} + $1, updated_at = CURRENT_TIMESTAMP
    `;
    
    if (incrementColumn) {
      query += `, ${incrementColumn} = ${incrementColumn} + 1`;
    }
    
    query += ' RETURNING *;';
    
    const result = await client.query(query, [change]);
    return result.rows[0];
  }

  /**
   * Get current counter values
   * @param {Object} client - PostgreSQL client for transaction
   * @returns {Promise<Object>} - Current counter values
   */
  static async getCounters(client) {
    const query = `
      SELECT * FROM counters
      LIMIT 1
      FOR UPDATE;
    `;
    
    const result = await client.query(query);
    return result.rows[0];
  }

  /**
   * Update counters based on the availability cascade logic
   * First try to fill waiting list, then RAC, then confirmed berths
   * @param {Object} client - PostgreSQL client for transaction
   * @returns {Promise<Object>} - Updated counter values
   */
  static async updateCountersCascade(client) {
    // Get current counters
    const countersQuery = `
      SELECT * FROM counters
      LIMIT 1
      FOR UPDATE;
    `;
    
    const countersResult = await client.query(countersQuery);
    const counters = countersResult.rows[0];
    
    // Determine which counter to update based on the cascade logic
    let updateColumn = '';
    
    if (counters.available_waiting_list < 10) {
      // If waiting list is not full, increment it
      updateColumn = 'available_waiting_list';
    } else if (counters.available_rac_berths < 18) {
      // If RAC is not full, increment it
      updateColumn = 'available_rac_berths';
    } else {
      // If both waiting list and RAC are full, increment confirmed berths
      updateColumn = 'available_confirmed_berths';
    }
    
    // Update the appropriate counter
    const updateQuery = `
      UPDATE counters
      SET ${updateColumn} = ${updateColumn} + 1, updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    
    const result = await client.query(updateQuery);
    
    // Update the current_waiting_list_number and current_rac_number
    await this.updateCurrentNumbers(client);
    
    return result.rows[0];
  }

  /**
   * Update the current_waiting_list_number and current_rac_number based on available seats
   * @param {Object} client - PostgreSQL client for transaction
   * @returns {Promise<void>}
   */
  static async updateCurrentNumbers(client) {
    // Get current counters
    const countersQuery = `
      SELECT * FROM counters
      LIMIT 1
      FOR UPDATE;
    `;
    
    const countersResult = await client.query(countersQuery);
    const counters = countersResult.rows[0];
    
    // Calculate correct values for current_waiting_list_number and current_rac_number
    
    const newWaitingListNumber = MAX_WAITING_LIST - counters.available_waiting_list;
    const newRacNumber = MAX_RAC_TICKETS - counters.available_rac_berths;
    
    // Update the counters with the new values
    const updateQuery = `
      UPDATE counters
      SET current_waiting_list_number = $1,
          current_rac_number = $2,
          updated_at = CURRENT_TIMESTAMP;
    `;
    
    await client.query(updateQuery, [newWaitingListNumber, newRacNumber]);
  }

}

module.exports = BaseTicket; 