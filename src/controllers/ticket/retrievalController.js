const Ticket = require('../../models/ticket');
const ApiResponse = require('../../utils/apiResponse');
const pool = require('../../config/db');
const { MAX_WAITING_LIST, MAX_RAC_TICKETS, TOTAL_CONFIRMED_BERTHS } = require('../../constants/reservationLimits');

/**
 * Controller for ticket retrieval operations
 */
class RetrievalController {
  /**
   * Get ticket details by PNR
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<Object>} - Response with ticket details
   */
  static async getTicketByPNR(req, res) {
    try {
      const { pnr } = req.params;
      
      const ticket = await Ticket.getByPNR(pnr);
      
      if (!ticket) {
        return ApiResponse.error(res, 'Ticket not found', 404);
      }
      
      return ApiResponse.success(res, 'Ticket details retrieved successfully', ticket);
    } catch (error) {
      console.error('Error getting ticket details:', error);
      return ApiResponse.error(
        res, 
        'An error occurred while getting ticket details', 
        500, 
        process.env.NODE_ENV === 'development' ? error.message : undefined
      );
    }
  }

  /**
   * Get all tickets
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<Object>} - Response with all tickets
   */
  static async getAllTickets(_req, res) {
    try {
      const tickets = await Ticket.getAllTickets();
      
      // Prepare summary counts
      const summary = {
        confirmed: tickets.confirmed.length,
        rac: tickets.rac.length,
        waitingList: tickets.waitingList.length,
        total: tickets.confirmed.length + tickets.rac.length + tickets.waitingList.length
      };
      
      return ApiResponse.success(res, 'All tickets retrieved successfully', {
        summary,
        tickets
      });
    } catch (error) {
      console.error('Error getting all tickets:', error);
      return ApiResponse.error(
        res, 
        'An error occurred while getting all tickets', 
        500, 
        process.env.NODE_ENV === 'development' ? error.message : undefined
      );
    }
  }

  /**
   * Get all booked tickets with passenger details and summary
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<Object>} - Response with booked tickets and summary
   */
  static async getBookedTickets(_req, res) {
    try {
      // Get all tickets
      const tickets = await Ticket.getAllTickets();
      
      // Prepare summary counts
      const summary = {
        confirmed: tickets.confirmed.length,
        rac: tickets.rac.length,
        waitingList: tickets.waitingList.length,
        total: tickets.confirmed.length + tickets.rac.length + tickets.waitingList.length
      };
      
      // Format the response to include additional details for each category
      const bookedTickets = {
        confirmed: {
          count: tickets.confirmed.length,
          tickets: tickets.confirmed.map(ticket => ({
            pnr: ticket.pnr,
            berth: ticket.berth ? {
              number: ticket.berth.berth_number,
              type: ticket.berth.berth_type
            } : null,
            passenger: {
              name: ticket.passenger.name,
              age: ticket.passenger.age,
              gender: ticket.passenger.gender,
              hasChildUnderFive: ticket.passenger.has_child_under_five
            },
            children: ticket.children
          }))
        },
        rac: {
          count: tickets.rac.length,
          tickets: tickets.rac.map(ticket => ({
            pnr: ticket.pnr,
            racNumber: ticket.rac_number,
            berth: ticket.berth ? {
              number: ticket.berth.berth_number,
              type: ticket.berth.berth_type
            } : null,
            passenger: {
              name: ticket.passenger.name,
              age: ticket.passenger.age,
              gender: ticket.passenger.gender,
              hasChildUnderFive: ticket.passenger.has_child_under_five
            },
            children: ticket.children
          }))
        },
        waitingList: {
          count: tickets.waitingList.length,
          tickets: tickets.waitingList.map(ticket => ({
            pnr: ticket.pnr,
            waitingListNumber: ticket.waiting_list_number,
            passenger: {
              name: ticket.passenger.name,
              age: ticket.passenger.age,
              gender: ticket.passenger.gender,
              hasChildUnderFive: ticket.passenger.has_child_under_five
            },
            children: ticket.children
          }))
        }
      };
      
      return ApiResponse.success(res, 'Booked tickets retrieved successfully', {
        summary,
        bookedTickets
      });
    } catch (error) {
      console.error('Error getting booked tickets:', error);
      return ApiResponse.error(
        res, 
        'An error occurred while getting booked tickets', 
        500, 
        process.env.NODE_ENV === 'development' ? error.message : undefined
      );
    }
  }

  /**
   * Get ticket availability information
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<Object>} - Response with ticket availability
   */
  static async getAvailableTickets(_req, res) {
    try {
      // Get the current counters from the database
      const countersQuery = `
        SELECT * FROM counters
        LIMIT 1;
      `;
      
      const countersResult = await pool.query(countersQuery);
      
      if (countersResult.rows.length === 0) {
        return ApiResponse.error(res, 'Counter information not found', 500);
      }
      
      const counters = countersResult.rows[0];
      
      // Calculate total booked tickets in each category
      const confirmedBooked = TOTAL_CONFIRMED_BERTHS - counters.available_confirmed_berths;
      const racBooked = MAX_RAC_TICKETS - counters.available_rac_berths;
      const waitingListBooked = MAX_WAITING_LIST - counters.available_waiting_list;
      
      const availability = {
        confirmed: {
          total: TOTAL_CONFIRMED_BERTHS,
          booked: confirmedBooked,
          available: counters.available_confirmed_berths,
          status: counters.available_confirmed_berths > 0 ? 'AVAILABLE' : 'FULL'
        },
        rac: {
          total: MAX_RAC_TICKETS,
          booked: racBooked,
          available: counters.available_rac_berths,
          status: counters.available_rac_berths > 0 ? 'AVAILABLE' : 'FULL'
        },
        waitingList: {
          total: MAX_WAITING_LIST,
          booked: waitingListBooked,
          available: counters.available_waiting_list,
          status: counters.available_waiting_list > 0 ? 'AVAILABLE' : 'FULL'
        },
        overall: {
          status: counters.available_confirmed_berths > 0 ? 'CONFIRMED_AVAILABLE' :
                 counters.available_rac_berths > 0 ? 'RAC_AVAILABLE' :
                 counters.available_waiting_list > 0 ? 'WAITING_LIST_AVAILABLE' : 'FULL'
        }
      };
      
      return ApiResponse.success(res, 'Ticket availability retrieved successfully', {
        availability
      });
    } catch (error) {
      console.error('Error getting ticket availability:', error);
      return ApiResponse.error(
        res, 
        'An error occurred while getting ticket availability', 
        500, 
        process.env.NODE_ENV === 'development' ? error.message : undefined
      );
    }
  }
}

module.exports = RetrievalController; 