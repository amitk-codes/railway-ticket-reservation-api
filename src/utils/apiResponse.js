/**
 * Utility functions for standardized API responses
 */
class ApiResponse {
  /**
   * Create a success response
   * @param {Object} res - Express response object
   * @param {string} message - Success message
   * @param {Object|Array} data - Response data
   * @param {number} statusCode - HTTP status code (default: 200)
   * @returns {Object} - Formatted success response
   */
  static success(res, message, data = null, statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data
    });
  }

  /**
   * Create an error response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code (default: 400)
   * @param {Object|Array} errors - Detailed error information
   * @returns {Object} - Formatted error response
   */
  static error(res, message, statusCode = 400, errors = null) {
    const response = {
      success: false,
      message
    };

    if (errors) {
      response.errors = errors;
    }

    return res.status(statusCode).json(response);
  }
}

module.exports = ApiResponse; 