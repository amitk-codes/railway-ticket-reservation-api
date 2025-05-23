/**
 * Constants defining the core constraints for the railway reservation system
 */
module.exports = {
  // Seat allocation limits
  TOTAL_CONFIRMED_BERTHS: 63,
  TOTAL_RAC_BERTHS: 9,
  MAX_RAC_TICKETS: 18, // 2 passengers per RAC berth
  MAX_WAITING_LIST: 10,
  
  // Age constraints
  CHILD_AGE_LIMIT: 5, // Children under 5 don't get a berth
  SENIOR_CITIZEN_AGE: 60, // Priority for lower berth
  
  // Berth types
  BERTH_TYPES: {
    LOWER: 'LOWER',
    MIDDLE: 'MIDDLE',
    UPPER: 'UPPER',
    SIDE_LOWER: 'SIDE_LOWER',
  },
  
  // Ticket status types
  TICKET_STATUS: {
    CONFIRMED: 'CONFIRMED',
    RAC: 'RAC',
    WAITING_LIST: 'WAITING_LIST'
  }
}; 