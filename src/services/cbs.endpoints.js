
const CBS_BASE_URL = process.env.CBS_BASE_URL


const API_ENDPOINTS = {
    AUTHENTICATION: '/v1/authentication',
    PRODUCT: '/v1/loanproducts',
    LOAN: '/v1/loans',
    CLIENTS: '/v1/clients',


    LIST_PRODUCTS: '/v1/loanproducts',
    GET_EMPLOYEES_LOAN: '/v1/loans',
    CALCULATE_POSSIBLE_LOAN_CHARGES: '/v1/loans?command=calculateLoanSchedule',
    SUBMIT_LOAN_REQ: '/v1/loans',
    GET_LOAN_DETAILS: '/v1/loans/',
    LOAN_CANCEL: '/v1/loans/',
    GET_LOAN_TEMPLATE: '/v1/loans/template',
    LOAN_TOP_UP: '/v1/loans/',
    LOAN_PAYOFF: '/v1/loans/',

    // Loan Restructuring & Rescheduling
    LOAN_RESHEDULE: '/v1/rescheduleloans',
    LOAN_RESHEDULE_TEMPLATE: '/v1/rescheduleloans/template',
    LOAN_MODIFICATION: '/v1/loans/', // + {loanId} for modifications
    LOAN_WRITE_OFF: '/v1/loans/', // + {loanId}?command=writeoff
    LOAN_RECOVERY: '/v1/loans/', // + {loanId}?command=recoverypayment
    
    // Additional restructuring options
    LOAN_SCHEDULE_PREVIEW: '/v1/loans/', // + {loanId}?command=calculateLoanSchedule
    LOAN_REPAYMENT_SCHEDULE: '/v1/loans/', // + {loanId}/repaymentschedule
    LOAN_TRANSACTIONS: '/v1/loans/' // + {loanId}/transactions
}

module.exports = {
    API_ENDPOINTS,
    CBS_BASE_URL
}