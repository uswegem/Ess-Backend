const logger = require('../utils/logger');
const { API_ENDPOINTS } = require('./cbs.endpoints');
const { maker: cbsApi, authManager, healthMonitor, errorHandler, requestManager } = require('./cbs.api');

/**
 * Service for handling client operations with CBS
 */
class ClientService {
    /**
     * Create a new client in CBS
     * @param {Object} clientData Client information (can be pre-formatted payload or raw client data)
     * @param {string} clientData.fullname Full name of the client
     * @param {string} clientData.officeId Office ID where client belongs
     * @param {string} clientData.dateFormat Date format for date fields
     * @param {string} clientData.locale Locale for the request
     * @param {string} clientData.active Whether to activate the client immediately
     * @param {string} clientData.activationDate Date of activation if active is true
     * @returns {Promise<Object>} Response from CBS
     */
    static async createClient(clientData) {
        try {
            const formattedEmploymentDate = clientData.employmentDate ? 
                new Date(clientData.employmentDate).toISOString().split('T')[0] : null;

            // Build datatables if we have the raw data
            const datatables = clientData.datatables || (
                clientData.checkNumber || clientData.applicationNumber || 
                clientData.employmentDate || clientData.swiftCode || 
                clientData.bankAccountNumber || clientData.mobileNo || 
                clientData.emailAddress || clientData.physicalAddress || 
                clientData.maritalStatus
            ) ? [{
                registeredTableName: "client_onboarding",
                data: {
                    CheckNumber: clientData.checkNumber || clientData.applicationNumber,
                    EmploymentDate: formattedEmploymentDate,
                    SwiftCode: clientData.swiftCode || null,
                    BankAccountNumber: clientData.bankAccountNumber || null,
                    PhoneNumber: clientData.mobileNo || clientData.mobileNumber,
                    EmailAddress: clientData.emailAddress,
                    PhysicalAddress: clientData.physicalAddress,
                    MaritalStatus: clientData.maritalStatus,
                    locale: "en",
                    dateFormat: "yyyy-MM-dd"
                }
            }] : undefined;

            // Merge passed fields with defaults - honor what's passed from caller
            const payload = {
                // Accept all fields from clientData first
                ...clientData,
                // Then apply defaults only for missing fields
                dateFormat: clientData.dateFormat || "yyyy-MM-dd",
                locale: clientData.locale || "en",
                active: clientData.active !== undefined ? clientData.active : true,
                submittedOnDate: clientData.submittedOnDate || new Date().toISOString().split('T')[0],
                activationDate: clientData.activationDate || new Date().toISOString().split('T')[0],
                officeId: clientData.officeId !== undefined ? clientData.officeId : 1,
                savingsProductId: clientData.savingsProductId !== undefined ? clientData.savingsProductId : null,
                clientTypeId: clientData.clientTypeId !== undefined ? clientData.clientTypeId : 17,
                legalFormId: clientData.legalFormId !== undefined ? clientData.legalFormId : 1,
                staffId: clientData.staffId !== undefined ? clientData.staffId : null,
                // Compute genderId if not provided
                genderId: clientData.genderId !== undefined ? clientData.genderId : 
                    (clientData.gender === 'M' || clientData.sex === 'M' ? 15 : 16),
                // Include datatables if available
                datatables: datatables
            };

            logger.info('🔵 Creating client in CBS:', payload);
            const response = await cbsApi.post(API_ENDPOINTS.CLIENTS, payload);
            logger.info('🟢 CBS client creation response:', {
                status: response.status,
                statusText: response.statusText,
                data: response.data
            });
            
            // Client creation includes datatable, no need for separate call
            
            return response;
        } catch (error) {
            logger.error('🔴 Error creating client:', error.message || error);
            throw error;
        }
    }

    /**
     * Search for a client by external ID
     * @param {string} externalId External ID to search for
     * @returns {Promise<Object>} Response from CBS with structure { totalFilteredRecords, pageItems }
     */
    static async searchClientByExternalId(externalId) {
        try {
            logger.info('🔵 Searching for client by external ID:', externalId);
            const response = await cbsApi.get(`${API_ENDPOINTS.CLIENTS}?externalId=${externalId}`);
            logger.info('🟢 CBS client search response:', {
                status: response.status,
                totalRecords: response.data?.totalFilteredRecords || 0,
                found: response.data?.pageItems?.length || 0
            });
            // Return the actual data, not the axios response wrapper
            return response.data || { totalFilteredRecords: 0, pageItems: [] };
        } catch (error) {
            logger.error('🔴 Error searching client:', error);
            // Return empty result instead of throwing, so the caller can proceed with creation
            return { totalFilteredRecords: 0, pageItems: [] };
        }
    }

    /**
     * Get client details by client ID
     * @param {string} clientId Client ID in CBS
     * @returns {Promise<Object>} Response from CBS
     */
    static async getClientDetails(clientId) {
        try {
            logger.info('🔵 Getting client details for ID:', clientId);
            const response = await cbsApi.get(`${API_ENDPOINTS.CLIENTS}/${clientId}`);
            logger.info('🟢 CBS client details response:', response);
            return response;
        } catch (error) {
            logger.error('🔴 Error getting client details:', error);
            throw error;
        }
    }
}

module.exports = ClientService;