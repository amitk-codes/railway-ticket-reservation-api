const BookingController = require('./bookingController');
const CancellationController = require('./cancellationController');
const RetrievalController = require('./retrievalController');

/**
 * Controller for ticket-related operations
 * Combines functionality from specialized controller modules
 */
class TicketController {
  // Booking operations
  static bookTicket = BookingController.bookTicket;
  
  // Cancellation operations
  static cancelTicket = CancellationController.cancelTicket;
  
  // Retrieval operations
  static getTicketByPNR = RetrievalController.getTicketByPNR;
  static getAllTickets = RetrievalController.getAllTickets;
  static getBookedTickets = RetrievalController.getBookedTickets;
  static getAvailableTickets = RetrievalController.getAvailableTickets;
}

module.exports = TicketController; 