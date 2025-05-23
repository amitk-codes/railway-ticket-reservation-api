const pool = require('../../config/db');
const { TICKET_STATUS, BERTH_TYPES, SENIOR_CITIZEN_AGE } = require('../../constants/reservationLimits');
const BaseTicket = require("./base");
const Passenger = require('../passenger');

/**
 * Booking operations for tickets
 */
class BookingOperations {
  /**
   * Get available berths based on passenger priority
   * @param {Object} passenger - Passenger data with age, gender, and has_child_under_five
   * @param {Object} client - PostgreSQL client for transaction
   * @returns {Promise<Object|null>} - Available berth or null if none available
   */
  static async getAvailableBerth(passenger, client) {
    let query = '';
    
    // Priority for lower berths for senior citizens (60+) and ladies with children
    if (passenger.age >= SENIOR_CITIZEN_AGE || 
        (passenger.gender === 'FEMALE' && passenger.has_child_under_five)) {
      // First try to find available lower berth
      query = `
        SELECT * FROM berths
        WHERE is_allocated = FALSE
        AND berth_type = '${BERTH_TYPES.LOWER}'
        ORDER BY berth_number
        LIMIT 1
        FOR UPDATE;
      `;
      
      const lowerBerthResult = await client.query(query);
      if (lowerBerthResult.rows.length > 0) {
        return lowerBerthResult.rows[0];
      }
    }
    
    // If no lower berth or not priority, get any available confirmed berth
    query = `
      SELECT * FROM berths
      WHERE is_allocated = FALSE
      AND berth_type IN ('${BERTH_TYPES.LOWER}', '${BERTH_TYPES.MIDDLE}', '${BERTH_TYPES.UPPER}')
      ORDER BY berth_number
      LIMIT 1
      FOR UPDATE;
    `;
    
    const result = await client.query(query);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Get available RAC berth (side-lower)
   * @param {Object} client - PostgreSQL client for transaction
   * @returns {Promise<Object|null>} - Available RAC berth or null if none available
   */
  static async getAvailableRACBerth(client) {
    const query = `
      SELECT * FROM berths
      WHERE is_allocated = FALSE
      AND berth_type = '${BERTH_TYPES.SIDE_LOWER}'
      ORDER BY berth_number
      LIMIT 1
      FOR UPDATE;
    `;
    
    const result = await client.query(query);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Handle ticket booking based on availability
   * @param {Object} passengerData - Passenger data
   * @param {Array<Object>} childrenData - Data for children under 5
   * @returns {Promise<Object>} - Booking result with ticket details
   */
  static async bookTicket(passengerData, childrenData = []) {
    const client = await pool.connect();
    
    try {
      // Start transaction
      await client.query('BEGIN');
      
      // Get current counters with lock
      const counters = await BaseTicket.getCounters(client);
      
      // Determine ticket status based on availability
      let ticketStatus;
      let berthId = null;
      let waitingListNumber = null;
      let racNumber = null;
      
      if (counters.available_confirmed_berths > 0 && passengerData.age >= 5) {
        // Confirmed ticket
        ticketStatus = TICKET_STATUS.CONFIRMED;
        
        // Get available berth based on priority
        const berth = await this.getAvailableBerth(passengerData, client);
        if (!berth) {
          throw new Error('No berths available despite counter showing availability');
        }
        
        berthId = berth.id;
        
        // Mark berth as allocated
        await BaseTicket.allocateBerth(berthId, client);
        
        // Update counters
        await BaseTicket.updateCounters(TICKET_STATUS.CONFIRMED, -1, client);
      } else if (counters.available_rac_berths > 0 && passengerData.age >= 5) {
        // RAC ticket
        ticketStatus = TICKET_STATUS.RAC;
        
        // Get RAC berth (side-lower)
        const racBerth = await this.getAvailableRACBerth(client);
        if (!racBerth) {
          throw new Error('No RAC berths available despite counter showing availability');
        }
        
        berthId = racBerth.id;
        
        // For RAC, we need to check if the berth is already allocated to one passenger
        // If yes, we allocate the same berth to another passenger (2 per RAC berth)
        // If no, we mark it as allocated
        const checkRACBerthQuery = `
          SELECT COUNT(*) as allocation_count
          FROM tickets
          WHERE berth_id = $1 AND status = '${TICKET_STATUS.RAC}';
        `;
        
        const racAllocationResult = await client.query(checkRACBerthQuery, [berthId]);
        const racAllocationCount = parseInt(racAllocationResult.rows[0].allocation_count);
        
        // If this is the second passenger for this RAC berth, mark it as fully allocated
        if (racAllocationCount === 0) {
          // First passenger for this RAC berth
          // Do not mark as fully allocated yet
        } else if (racAllocationCount === 1) {
          // Second passenger for this RAC berth
          // Mark berth as allocated
          await BaseTicket.allocateBerth(berthId, client);
        } else {
          throw new Error('RAC berth already has maximum passengers');
        }
        
        // Get the next RAC number based on the counter
        racNumber = 18 - counters.available_rac_berths + 1;
        
        // Update counters
        await BaseTicket.updateCounters(TICKET_STATUS.RAC, -1, client);
      } else if (counters.available_waiting_list > 0 && passengerData.age >= 5) {
        // Waiting list ticket
        ticketStatus = TICKET_STATUS.WAITING_LIST;
        
        // Get the next waiting list number based on the counter
        waitingListNumber = 10 - counters.available_waiting_list + 1;
        
        // Update counters
        await BaseTicket.updateCounters(TICKET_STATUS.WAITING_LIST, -1, client);
      } else if (passengerData.age < 5) {
        // Children under 5 don't get a berth, but record passenger anyway
        ticketStatus = TICKET_STATUS.CONFIRMED;
      } else {
        // No tickets available
        await client.query('ROLLBACK');
        return { success: false, message: 'No tickets available' };
      }
      
      // Create passenger
      const passenger = await Passenger.create(passengerData, client);
      
      // Create ticket
      const ticketData = {
        passenger_id: passenger.id,
        berth_id: berthId,
        status: ticketStatus,
        waiting_list_number: waitingListNumber,
        rac_number: racNumber
      };
      
      const ticket = await BaseTicket.create(ticketData, client);
      
      // Add children if any
      const createdChildren = [];
      for (const childData of childrenData) {
        const child = await Passenger.createChild({
          ...childData,
          parent_passenger_id: passenger.id
        }, client);
        
        createdChildren.push(child);
      }
      
      // Commit transaction
      await client.query('COMMIT');
      
      return {
        success: true,
        ticket: {
          ...ticket,
          passenger,
          children: createdChildren
        }
      };
    } catch (error) {
      // Rollback transaction on error
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

}

module.exports = BookingOperations; 