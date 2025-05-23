const Ticket = require('../../models/ticket');
const ApiResponse = require('../../utils/apiResponse');

/**
 * Controller for ticket booking operations
 */
class BookingController {
  /**
   * Book a new ticket
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<Object>} - Response with booking status
   */
  static async bookTicket(req, res) {
    try {
      const { passenger, children = [] } = req.body;
      
      // If passenger has a child under 5, update has_child_under_five flag
      if (children && children.length > 0) {
        passenger.has_child_under_five = true;
      }
      
      // Book ticket
      const result = await Ticket.bookTicket(passenger, children);
      
      if (!result.success) {
        return ApiResponse.error(res, result.message);
      }
      
      // Format response
      const { ticket } = result;
      
      const responseData = {
        pnr: ticket.pnr,
        status: ticket.status,
        passenger: {
          name: ticket.passenger.name,
          age: ticket.passenger.age,
          gender: ticket.passenger.gender
        },
        berth_id: ticket.berth_id,
        waiting_list_number: ticket.waiting_list_number,
        rac_number: ticket.rac_number,
        children: ticket.children.map(child => ({
          name: child.name,
          age: child.age,
          gender: child.gender
        }))
      };
      
      return ApiResponse.success(
        res, 
        'Ticket booked successfully', 
        responseData, 
        201
      );
    } catch (error) {
      console.error('Error booking ticket:', error);
      return ApiResponse.error(
        res, 
        'An error occurred while booking the ticket', 
        500, 
        process.env.NODE_ENV === 'development' ? error.message : undefined
      );
    }
  }

}

module.exports = BookingController; 