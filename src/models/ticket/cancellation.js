const pool = require('../../config/db');
const { TICKET_STATUS } = require('../../constants/reservationLimits');
const BaseTicket = require("./base");
const BookingOperations = require('./booking');

/**
 * Cancellation operations for tickets
 */
class CancellationOperations {
  /**
   * Cancel a ticket and handle promotions
   * @param {string} pnr - PNR number of the ticket to cancel
   * @returns {Promise<Object>} - Cancellation result
   */
  static async cancelTicket(pnr) {
    const client = await pool.connect();
    
    try {
      // Start transaction
      await client.query('BEGIN');
      
      // Get ticket details with lock
      const ticketQuery = `
        SELECT 
          t.id, t.pnr, t.status, t.waiting_list_number, t.rac_number, t.berth_id,
          p.id as passenger_id
        FROM tickets t
        JOIN passengers p ON t.passenger_id = p.id
        WHERE t.pnr = $1
        FOR UPDATE;
      `;
      
      const ticketResult = await client.query(ticketQuery, [pnr]);
      
      if (ticketResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Ticket not found' };
      }
      
      const ticket = ticketResult.rows[0];
      
      // Process based on ticket status
      if (ticket.status === TICKET_STATUS.CONFIRMED) {
        // For confirmed tickets:
        // 1. Free the berth
        // 2. Promote RAC passenger to confirmed (if any)
        // 3. Promote waiting list passenger to RAC (if any)
        // 4. Update the counter based on availability cascade
        
        // Free the berth if not null (for children under 5, berth_id might be null)
        if (ticket.berth_id) {
          const berthQuery = `
            UPDATE berths
            SET is_allocated = FALSE, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *;
          `;
          
          await client.query(berthQuery, [ticket.berth_id]);
        }
        
        // Promote RAC to Confirmed
        await this.promoteRACToConfirmed(client);
        
        // Promote Waiting List to RAC
        await this.promoteWaitingListToRAC(client);
        
        // Update counters based on availability cascade
        await BaseTicket.updateCountersCascade(client);
        
      } else if (ticket.status === TICKET_STATUS.RAC) {
        // Free the berth
        if (ticket.berth_id) {
          const berthQuery = `
            UPDATE berths
            SET is_allocated = FALSE, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1;
          `;
          
          await client.query(berthQuery, [ticket.berth_id]);
        }
        
        // Promote Waiting List to RAC
        await this.promoteWaitingListToRAC(client);
        
        // Update counters based on availability cascade
        await BaseTicket.updateCountersCascade(client);
        
      } else if (ticket.status === TICKET_STATUS.WAITING_LIST) {
        // For Waiting List tickets:
        // Update counters based on availability cascade
        await BaseTicket.updateCountersCascade(client);
      }
      
      // Delete ticket
      const deleteTicketQuery = `
        DELETE FROM tickets
        WHERE id = $1
        RETURNING *;
      `;
      
      await client.query(deleteTicketQuery, [ticket.id]);
      
      // Commit transaction
      await client.query('COMMIT');
      
      return {
        success: true,
        message: 'Ticket cancelled successfully',
        pnr
      };
    } catch (error) {
      // Rollback transaction on error
      await client.query('ROLLBACK');
      console.error('Error cancelling ticket:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Promote a RAC passenger to confirmed status
   * @param {Object} client - PostgreSQL client for transaction
   * @returns {Promise<boolean>} - Whether a promotion was made
   */
  static async promoteRACToConfirmed(client) {
    try {
      // Get the RAC ticket with the lowest RAC number
      const racTicketQuery = `
        SELECT t.id, t.passenger_id, t.berth_id as old_berth_id
        FROM tickets t
        WHERE t.status = $1
        ORDER BY t.rac_number
        LIMIT 1
        FOR UPDATE;
      `;
      
      const racTicketResult = await client.query(racTicketQuery, [TICKET_STATUS.RAC]);
      
      if (racTicketResult.rows.length === 0) {
        // No RAC tickets to promote
        return false;
      }
      
      const racTicket = racTicketResult.rows[0];
      
      // Get passenger details for berth allocation priority
      const passengerQuery = `
        SELECT * FROM passengers
        WHERE id = $1;
      `;
      
      const passengerResult = await client.query(passengerQuery, [racTicket.passenger_id]);
      const passenger = passengerResult.rows[0];
      
      // Get an available berth based on passenger priority
      const berth = await BookingOperations.getAvailableBerth(passenger, client);
      
      if (!berth) {
        console.error('No berths available for RAC promotion despite counter showing availability');
        return false;
      }
      
      // Mark berth as allocated
      await BaseTicket.allocateBerth(berth.id, client);
      
      // Update the ticket status from RAC to CONFIRMED
      const updateTicketQuery = `
        UPDATE tickets
        SET status = $1, 
            berth_id = $2, 
            rac_number = NULL, 
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3;
      `;
      
      await client.query(updateTicketQuery, [
        TICKET_STATUS.CONFIRMED, 
        berth.id, 
        racTicket.id
      ]);
      
      // Check if the old RAC berth should be freed      
      if (racTicket.old_berth_id) {
        // No more RAC passengers on this berth, free it
        const freeBerthQuery = `
          UPDATE berths
          SET is_allocated = FALSE, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1;
        `;
        
        await client.query(freeBerthQuery, [racTicket.old_berth_id]);
      }
      
      return true;
    } catch (error) {
      console.error('Error promoting RAC to confirmed:', error);
      throw error;
    }
  }

  /**
   * Promote a waiting list passenger to RAC status
   * @param {Object} client - PostgreSQL client for transaction
   * @returns {Promise<boolean>} - Whether a promotion was made
   */
  static async promoteWaitingListToRAC(client) {
    try {
      // Get the waiting list ticket with the lowest waiting list number
      const wlTicketQuery = `
        SELECT t.id, t.passenger_id
        FROM tickets t
        WHERE t.status = $1
        ORDER BY t.waiting_list_number
        LIMIT 1
        FOR UPDATE;
      `;
      
      const wlTicketResult = await client.query(wlTicketQuery, [TICKET_STATUS.WAITING_LIST]);
      
      if (wlTicketResult.rows.length === 0) {
        // No waiting list tickets to promote
        return false;
      }
      
      const wlTicket = wlTicketResult.rows[0];
      
      // Get an available RAC berth
      const racBerth = await BookingOperations.getAvailableRACBerth(client);
      
      if (!racBerth) {
        console.error('No RAC berths available for waiting list promotion despite counter showing availability');
        return false;
      }
      
      // Get the current RAC number to assign based on the next available position
      const countersQuery = `
        SELECT MAX(rac_number) as max_rac_number FROM tickets
        WHERE status = $1;
      `;
      
      const countersResult = await client.query(countersQuery, [TICKET_STATUS.RAC]);
      const currentRACNumber = (countersResult.rows[0].max_rac_number || 0) + 1;
      
      // Update the ticket status from WAITING_LIST to RAC
      const updateTicketQuery = `
        UPDATE tickets
        SET status = $1, 
            berth_id = $2, 
            rac_number = $3, 
            waiting_list_number = NULL, 
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4;
      `;
      
      await client.query(updateTicketQuery, [
        TICKET_STATUS.RAC, 
        racBerth.id, 
        currentRACNumber, 
        wlTicket.id
      ]);
      
      // Check if this is the second passenger for this RAC berth
      const racSharingQuery = `
        SELECT COUNT(*) as sharing_count
        FROM tickets
        WHERE berth_id = $1 AND status = $2;
      `;
      
      const racSharingResult = await client.query(
        racSharingQuery, 
        [racBerth.id, TICKET_STATUS.RAC]
      );
      
      const sharingCount = parseInt(racSharingResult.rows[0].sharing_count);
      
      if (sharingCount > 1) {
        // This is the second passenger for this RAC berth, mark it as allocated
        await BaseTicket.allocateBerth(racBerth.id, client);
      }
      
      return true;
    } catch (error) {
      console.error('Error promoting waiting list to RAC:', error);
      throw error;
    }
  }

}

module.exports = CancellationOperations; 