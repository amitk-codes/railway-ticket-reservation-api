const pool = require('../../config/db');

/**
 * Passenger model for database operations related to passengers
 */
class Passenger {
  /**
   * Create a new passenger
   * @param {Object} passengerData - Passenger information
   * @param {string} passengerData.name - Passenger name
   * @param {number} passengerData.age - Passenger age
   * @param {string} passengerData.gender - Passenger gender (MALE, FEMALE, OTHER)
   * @param {boolean} passengerData.has_child_under_five - Whether passenger has a child under 5
   * @param {Object} client - PostgreSQL client for transaction
   * @returns {Promise<Object>} - Created passenger data
   */
  static async create(passengerData, client) {
    const { name, age, gender, has_child_under_five = false } = passengerData;
    
    const query = `
      INSERT INTO passengers (name, age, gender, has_child_under_five)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    
    const result = await client.query(query, [name, age, gender, has_child_under_five]);
    return result.rows[0];
  }

  /**
   * Create a child under 5 (who doesn't get a berth)
   * @param {Object} childData - Child information
   * @param {string} childData.name - Child name
   * @param {number} childData.age - Child age
   * @param {string} childData.gender - Child gender (MALE, FEMALE, OTHER)
   * @param {number} childData.parent_passenger_id - ID of parent passenger
   * @param {Object} client - PostgreSQL client for transaction
   * @returns {Promise<Object>} - Created child data
   */
  static async createChild(childData, client) {
    const { name, age, gender, parent_passenger_id } = childData;
    
    const query = `
      INSERT INTO children (name, age, gender, parent_passenger_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    
    const result = await client.query(query, [name, age, gender, parent_passenger_id]);
    return result.rows[0];
  }

  /**
   * Get a passenger by ID
   * @param {number} id - Passenger ID
   * @returns {Promise<Object>} - Passenger data
   */
  static async getById(id) {
    const query = `
      SELECT * FROM passengers
      WHERE id = $1;
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }
}

module.exports = Passenger; 