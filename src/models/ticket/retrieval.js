const pool = require('../../config/db');
const { TICKET_STATUS } = require('../../constants/reservationLimits');

/**
 * Retrieval operations for tickets
 */
class RetrievalOperations {
  /**
   * Get all tickets in the system
   * @returns {Promise<Object>} - Object containing all tickets grouped by status
   */
  static async getAllTickets() {
    const query = `
      SELECT 
        t.id, t.pnr, t.status, t.waiting_list_number, t.rac_number,
        p.id as passenger_id, p.name, p.age, p.gender, p.has_child_under_five,
        b.id as berth_id, b.berth_number, b.berth_type,
        c.id as child_id, c.name as child_name, c.age as child_age, c.gender as child_gender
      FROM tickets t
      JOIN passengers p ON t.passenger_id = p.id
      LEFT JOIN berths b ON t.berth_id = b.id
      LEFT JOIN children c ON p.id = c.parent_passenger_id
      ORDER BY 
        CASE 
          WHEN t.status = '${TICKET_STATUS.CONFIRMED}' THEN 1
          WHEN t.status = '${TICKET_STATUS.RAC}' THEN 2
          WHEN t.status = '${TICKET_STATUS.WAITING_LIST}' THEN 3
        END,
        COALESCE(b.berth_number, 0),
        COALESCE(t.rac_number, 0),
        COALESCE(t.waiting_list_number, 0);
    `;
    
    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      return {
        confirmed: [],
        rac: [],
        waitingList: []
      };
    }
    
    // Process the tickets
    const ticketsByPNR = {};
    
    // Group tickets by PNR and add children to their parents
    result.rows.forEach(row => {
      if (!ticketsByPNR[row.pnr]) {
        // Create a new ticket object
        ticketsByPNR[row.pnr] = {
          id: row.id,
          pnr: row.pnr,
          status: row.status,
          waiting_list_number: row.waiting_list_number,
          rac_number: row.rac_number,
          passenger: {
            id: row.passenger_id,
            name: row.name,
            age: row.age,
            gender: row.gender,
            has_child_under_five: row.has_child_under_five
          },
          berth: row.berth_id ? {
            id: row.berth_id,
            berth_number: row.berth_number,
            berth_type: row.berth_type
          } : null,
          children: []
        };
      }
      
      // Add child if present
      if (row.child_id) {
        // Check if the child is already added
        const childExists = ticketsByPNR[row.pnr].children.some(child => child.id === row.child_id);
        
        if (!childExists) {
          ticketsByPNR[row.pnr].children.push({
            id: row.child_id,
            name: row.child_name,
            age: row.child_age,
            gender: row.child_gender
          });
        }
      }
    });
    
    // Convert to array and group by status
    const tickets = Object.values(ticketsByPNR);
    
    return {
      confirmed: tickets.filter(ticket => ticket.status === TICKET_STATUS.CONFIRMED),
      rac: tickets.filter(ticket => ticket.status === TICKET_STATUS.RAC),
      waitingList: tickets.filter(ticket => ticket.status === TICKET_STATUS.WAITING_LIST)
    };
  }
}

module.exports = RetrievalOperations; 