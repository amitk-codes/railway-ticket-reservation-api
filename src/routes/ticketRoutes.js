const express = require('express');
const TicketController = require('../controllers/ticket');
const { validateBookingRequest } = require('../middlewares/validation');

const router = express.Router();

/**
 * @route GET /api/v1/tickets/booked
 * @desc Get all booked tickets with passenger details and summary
 * @access Public
 */
router.get('/booked', TicketController.getBookedTickets);

/**
 * @route GET /api/v1/tickets/available
 * @desc Get ticket availability information
 * @access Public
 */
router.get('/available', TicketController.getAvailableTickets);

/**
 * @route POST /api/v1/tickets/book
 * @desc Book a new ticket
 * @access Public
 */
router.post('/book', validateBookingRequest, TicketController.bookTicket);

/**
 * @route POST /api/v1/tickets/cancel/:pnr
 * @desc Cancel a ticket by PNR and handle promotions
 * @access Public
 */
router.post('/cancel/:pnr', TicketController.cancelTicket);

/**
 * @route GET /api/v1/tickets/:pnr
 * @desc Get ticket details by PNR
 * @access Public
 */
router.get('/:pnr', TicketController.getTicketByPNR);

module.exports = router; 