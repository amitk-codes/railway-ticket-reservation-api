const { body, validationResult } = require('express-validator');
const { CHILD_AGE_LIMIT } = require('../constants/reservationLimits');

/**
 * Middleware to validate booking request data
 */
const validateBookingRequest = [
  // Validate passenger data
  body('passenger.name')
    .notEmpty().withMessage('Passenger name is required')
    .isString().withMessage('Passenger name must be a string')
    .isLength({ min: 2, max: 100 }).withMessage('Passenger name must be between 2 and 100 characters'),
  
  body('passenger.age')
    .notEmpty().withMessage('Passenger age is required')
    .isInt({ min: 0, max: 120 }).withMessage('Passenger age must be between 0 and 120'),
  
  body('passenger.gender')
    .notEmpty().withMessage('Passenger gender is required')
    .isIn(['MALE', 'FEMALE', 'OTHER']).withMessage('Gender must be MALE, FEMALE, or OTHER'),
  
  body('passenger.has_child_under_five')
    .optional()
    .isBoolean().withMessage('has_child_under_five must be a boolean'),
  
  // Validate children data if present
  body('children')
    .optional()
    .isArray().withMessage('Children must be an array'),
  
  body('children.*.name')
    .optional()
    .isString().withMessage('Child name must be a string')
    .isLength({ min: 2, max: 100 }).withMessage('Child name must be between 2 and 100 characters'),
  
  body('children.*.age')
    .optional()
    .isInt({ min: 0, max: CHILD_AGE_LIMIT - 1 }).withMessage(`Child age must be between 0 and ${CHILD_AGE_LIMIT - 1}`),
  
  body('children.*.gender')
    .optional()
    .isIn(['MALE', 'FEMALE', 'OTHER']).withMessage('Gender must be MALE, FEMALE, or OTHER'),
  
  // Custom validation: If has_child_under_five is true, children array should not be empty
  (req, res, next) => {
    const { passenger, children } = req.body;
    
    if (passenger && passenger.has_child_under_five === true) {
      if (!children || !Array.isArray(children) || children.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Children array must not be empty when has_child_under_five is true'
        });
      }
      
      // Verify at least one child is under 5
      const hasChildUnderFive = children.some(child => child.age < CHILD_AGE_LIMIT);
      if (!hasChildUnderFive) {
        return res.status(400).json({
          success: false,
          message: `At least one child must be under ${CHILD_AGE_LIMIT} when has_child_under_five is true`
        });
      }
    }
    
    next();
  },
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    next();
  }
];

module.exports = {
  validateBookingRequest
}; 