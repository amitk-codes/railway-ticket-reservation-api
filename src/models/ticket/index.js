const BaseTicket = require('./base');
const BookingOperations = require('./booking');
const CancellationOperations = require('./cancellation');
const RetrievalOperations = require('./retrieval');

/**
 * Ticket model for database operations related to tickets
 * Combines functionality from specialized modules
 */
class Ticket {
  // Base operations
  static generatePNR = BaseTicket.generatePNR;
  static create = BaseTicket.create;
  static getByPNR = BaseTicket.getByPNR;
  static getCounters = BaseTicket.getCounters;
  static updateCounters = BaseTicket.updateCounters;
  static allocateBerth = BaseTicket.allocateBerth;
  static updateCurrentNumbers = BaseTicket.updateCurrentNumbers;
  static updateCountersCascade = BaseTicket.updateCountersCascade;

  // Booking operations
  static bookTicket = BookingOperations.bookTicket;
  static getAvailableBerth = BookingOperations.getAvailableBerth;
  static getAvailableRACBerth = BookingOperations.getAvailableRACBerth;

  // Cancellation operations
  static cancelTicket = CancellationOperations.cancelTicket;
  static promoteRACToConfirmed = CancellationOperations.promoteRACToConfirmed;
  static promoteWaitingListToRAC = CancellationOperations.promoteWaitingListToRAC;

  // Retrieval operations
  static getAllTickets = RetrievalOperations.getAllTickets;
}

module.exports = Ticket; 