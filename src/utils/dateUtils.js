const logger = require('./logger');

/**
 * Formats a date string into 'dd MMMM yyyy' format for MIFOS.
 * @param {string} dateString - The date string to format.
 * @returns {string|null} The formatted date string or null if input is invalid.
 */
function formatDateForMifos(dateString) {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null; // Invalid date

    const day = date.getDate();
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
}

/**
 * Formats a date into 'YYYY-MM-DD' format for ESS_UTUMISHI responses.
 * Used for: TCEffectiveDate, EmploymentDate, ConfirmationDate, ContractStartDate, 
 * ContractEndDate, PayrollDate, CheckDate
 * @param {Date|string} dateInput - The date to format (Date object or date string).
 * @returns {string|null} The formatted date string (YYYY-MM-DD) or null if input is invalid.
 */
function formatDateForUTUMISHI(dateInput) {
    if (!dateInput) return null;
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) return null; // Invalid date
    return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
}

/**
 * Formats a date into 'YYYY-MM-DDTHH:MM:SS' format for ESS_UTUMISHI timestamp fields.
 * Used for: DisbursementDate, FinalPaymentDate, LastDeductionDate, LastPayDate, 
 * EndDate, ValidityDate, LastRepaymentDate, MaturityDate, DeductionEndDate, 
 * FSP1FinalPaymentDate, PaymentDate, PayDate, StopDate
 * @param {Date|string} dateInput - The date to format (Date object or date string).
 * @returns {string|null} The formatted date string (YYYY-MM-DDTHH:MM:SS) or null if input is invalid.
 */
function formatDateTimeForUTUMISHI(dateInput) {
    if (!dateInput) return null;
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) return null; // Invalid date
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

module.exports = {
    formatDateForMifos,
    formatDateForUTUMISHI,
    formatDateTimeForUTUMISHI
};
