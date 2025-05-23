const Ticket = require('../../models/ticket');
const ApiResponse = require('../../utils/apiResponse');

/**
 * Controller for ticket cancellation operations
 */
class CancellationController {
  /**
   * Cancel a ticket and handle promotions
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<Object>} - Response with cancellation status
   */
  static async cancelTicket(req, res) {
    try {
      const { pnr } = req.params;
      
      if (!pnr) {
        return ApiResponse.error(res, 'PNR is required', 400);
      }
      
      // Cancel ticket and handle promotions
      const result = await Ticket.cancelTicket(pnr);
      
      if (!result.success) {
        return ApiResponse.error(res, result.message, 404);
      }
      
      return ApiResponse.success(
        res, 
        'Ticket cancelled successfully', 
        { pnr: result.pnr }
      );
    } catch (error) {
      console.error('Error cancelling ticket:', error);
      return ApiResponse.error(
        res, 
        'An error occurred while cancelling the ticket', 
        500, 
        process.env.NODE_ENV === 'development' ? error.message : undefined
      );
    }
  }

}

module.exports = CancellationController; 