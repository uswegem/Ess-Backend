const logger = require('../utils/logger');
// Mock Customer Service
class CustomerService {
  /**
   * Get customer number and customer ID
   */
  async getCustomerNumberAndCustomerId(country, checkNumber) {
    logger.info(`Getting customer data for check number ${checkNumber} in ${country}`);

    // Mock implementation - in real scenario, this would query customer database
    // Return null if customer not found, or [customerNumber, customerId] if found
    return null; // Mock: customer not found, so it's a new customer
  }
}

module.exports = new CustomerService();