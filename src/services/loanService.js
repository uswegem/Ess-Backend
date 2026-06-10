const logger = require('../utils/logger');
const { sendResponse } = require("../utils/responseHelper");
const api = require("./cbs.api");
const { API_ENDPOINTS } = require("./cbs.endpoints");
const PossibleLoanCharges = require("../models/PossibleLoanCharges");
const eligibilityService = require("./eligibilityService");
const activeLoanProvider = require("./activeLoanProvider");
const customerService = require("./customerService");
const LoanCalculations = require("../utils/loanCalculations");
const {
  validateRetirementAge,
  calculateMonthsUntilRetirement,
  ApplicationException,
  LOAN_CONSTANTS
} = require("../utils/loanUtils");

// Enhanced CBS services
const { authManager, healthMonitor, errorHandler, requestManager } = api;

// Helper functions for comprehensive affordability calculation
async function searchClientByExternalId(externalId) {
    try {
        const response = await api.get(`/v1/clients?externalId=${externalId}`);
        if (response.status && response.response && response.response.length > 0) {
            return response.response[0];
        }
        return null;
    } catch (error) {
        logger.info('Client search error:', error.message);
        return null;
    }
}

async function getClientLoans(clientId) {
    try {
        const response = await api.get(`/v1/clients/${clientId}/accounts`);
        if (response.status && response.response && response.response.loanAccounts) {
            return response.response.loanAccounts;
        }
        return [];
    } catch (error) {
        logger.info('Client loans fetch error:', error.message);
        return [];
    }
}

async function getProductDetails(productCode) {
    try {
        const response = await api.get(`/v1/loanproducts/${productCode}`);
        if (response.status && response.response) {
            return response.response;
        }
        return null;
    } catch (error) {
        logger.info('Product details fetch error:', error.message);
        return null;
    }
}

function calculateForwardLoan(principal, annualInterestRate, tenure) {
    const monthlyEMI = LoanCalculations.calculateEMI(principal, annualInterestRate, tenure);
    const totalAmount = monthlyEMI * tenure;
    const totalInterest = totalAmount - principal;

    return {
        principalAmount: principal,
        monthlyEMI: monthlyEMI,
        totalAmount: totalAmount,
        totalInterest: totalInterest,
        tenure: tenure
    };
}

function calculateReverseLoan(monthlyEMI, annualInterestRate, tenure) {
    const principal = LoanCalculations.calculateMaxLoanFromEMI(monthlyEMI, annualInterestRate, tenure);
    const totalAmount = monthlyEMI * tenure;
    const totalInterest = totalAmount - principal;

    return {
        principalAmount: principal,
        monthlyEMI: monthlyEMI,
        totalAmount: totalAmount,
        totalInterest: totalInterest,
        tenure: tenure
    };
}

function calculatePayoffAmount(loan) {
    // Calculate the amount needed to pay off the existing loan
    // This includes outstanding principal + accrued interest
    try {
        const outstandingBalance = loan.principal || loan.outstandingBalance || 0;
        // In a real implementation, this would calculate accrued interest
        // For now, using outstanding balance as payoff amount
        return outstandingBalance;
    } catch (error) {
        logger.error('Error calculating payoff amount:', error);
        return 0;
    }
}

function generateLoanChargesErrorResponse({ msgId, checkNumber, errorMessage }) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>FSP_SYSTEM</Sender>
            <Receiver>${process.env.EXTERNAL_SYSTEM || 'ESS_UTUMISHI'}</Receiver>
            <FSPCode>${process.env.FSP_CODE || 'FL8090'}</FSPCode>
            <MsgId>${msgId}</MsgId>
            <MessageType>LOAN_CHARGES_RESPONSE</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>${checkNumber}</CheckNumber>
            <ResponseCode>9005</ResponseCode>
            <Description>Exception occurred while requesting loan charges to FSP. Please try again later</Description>
            <ErrorDetail>${errorMessage}</ErrorDetail>
        </MessageDetails>
    </Data>
</Document>`;
}

const LoanCalculate = async (data) => {
    try {
        logger.info('🔄 Processing ESS LOAN_CHARGES_REQUEST with enhanced affordability logic');

        if (!data || typeof data !== 'object') {
            throw new Error('Invalid loan charges request data');
        }

        const {
            checkNumber,
            designationCode,
            designationName,
            basicSalary,
            netSalary,
            oneThirdAmount,
            deductibleAmount,
            retirementDate,
            termsOfEmployment,
            requestedAmount,
            desiredDeductibleAmount,
            tenure,
            fspCode,
            productCode,
            voteCode,
            totalEmployeeDeduction,
            jobClassCode
        } = data;

        // Validate required fields
        if (!checkNumber) {
            throw new Error('Check number is required');
        }

        // Create UtumishiOfferRequest object for persistence
        const utumishiRequest = {
            checkNumber,
            designationCode,
            designationName,
            basicSalary: basicSalary || 0,
            netSalary: netSalary || 0,
            oneThirdAmount: oneThirdAmount || 0,
            deductibleAmount: deductibleAmount || 0,
            retirementDate,
            termsOfEmployment,
            requestedAmount: requestedAmount || 0,
            desiredDeductibleAmount: desiredDeductibleAmount || 0,
            tenure: tenure || 0,
            fspCode,
            productCode: productCode,
            voteCode,
            totalEmployeeDeduction: totalEmployeeDeduction || 0,
            jobClassCode
        };

        // Calculate affordability parameters
        const maxAffordableEMI = deductibleAmount && deductibleAmount > 0
            ? deductibleAmount
            : Math.floor((netSalary || 0) - (oneThirdAmount || 0));

        // CONSERVATIVE APPROACH: Cap DesiredDeductibleAmount at maxAffordableEMI (DeductibleAmount)
        const desirableEMI = desiredDeductibleAmount && desiredDeductibleAmount > 0
            ? Math.min(desiredDeductibleAmount, maxAffordableEMI)
            : maxAffordableEMI;
        
        // Log warning if capping occurred
        if (desiredDeductibleAmount > 0 && desiredDeductibleAmount > maxAffordableEMI) {
            logger.warn(`⚠️ DesiredDeductibleAmount (${desiredDeductibleAmount}) exceeds maxAffordableEMI (${maxAffordableEMI}). Capped for affordability.`);
        }

        // Log the EMI constraint being used for loan calculation
        logger.info(`💰 Using EMI constraint: ${desirableEMI} (ensures MonthlyReturnAmount ≤ DesiredDeductibleAmount)`);

        // Calculate retirement months left
        const retirementMonthsLeft = calculateMonthsUntilRetirement(retirementDate);

        // Determine tenure with retirement validation
        let calculatedTenure = tenure && tenure > 0 ? tenure : LOAN_CONSTANTS.DEFAULT_TENURE;
        calculatedTenure = validateRetirementAge(calculatedTenure, retirementMonthsLeft);

        // Determine affordability type
        const affordabilityType = (!requestedAmount || requestedAmount <= 0) && calculatedTenure
            ? LOAN_CONSTANTS.AFFORDABILITY_TYPE.REVERSE
            : LOAN_CONSTANTS.AFFORDABILITY_TYPE.FORWARD;

        logger.info(`Affordability Type: ${affordabilityType}`);
        logger.info(`Max Affordable EMI: ${maxAffordableEMI}`);
        logger.info(`Desirable EMI: ${desirableEMI}`);
        logger.info(`Central Reg Affordability (used for calculation): ${affordabilityType === LOAN_CONSTANTS.AFFORDABILITY_TYPE.REVERSE ? desirableEMI : deductibleAmount}`);
        logger.info(`Desirable EMI: ${desirableEMI}`);
        logger.info(`Calculated Tenure: ${calculatedTenure}`);

        // Initialize loan amount with requested amount
        let loanAmount = requestedAmount || 0;

        // Save initial request to database
        // Validate final loan amount before saving
        if (loanAmount < LOAN_CONSTANTS.MIN_LOAN_AMOUNT) {
            logger.warn(`Final loan amount ${loanAmount} is below minimum ${LOAN_CONSTANTS.MIN_LOAN_AMOUNT}`);
            loanAmount = LOAN_CONSTANTS.MIN_LOAN_AMOUNT;
            // Recalculate monthly installment based on minimum loan amount
            monthlyInstallment = await LoanCalculations.calculateEMI(loanAmount, LOAN_CONSTANTS.DEFAULT_INTEREST_RATE, calculatedTenure);
        }

        let possibleLoanChargesEntity = null;
        try {
            possibleLoanChargesEntity = await PossibleLoanCharges.create({
                productCode: productCode,
                productName: 'DAS',
                idNumber: checkNumber,
                idNumberType: 'CHECK_NUMBER',
                loanAmount: loanAmount, // Add loan amount to record
                monthlyInstallment: monthlyInstallment, // Add installment to record
                request: JSON.stringify(utumishiRequest)
            });
            logger.info(`Created PossibleLoanCharges entity with ID: ${possibleLoanChargesEntity._id}`);
        } catch (dbError) {
            logger.warn('Database not available, continuing without persistence:', dbError.message);
            // Create a mock entity for processing
            possibleLoanChargesEntity = {
                _id: 'mock-id',
                updateOne: async () => {},
                save: async () => {}
            };
        }

        // Fetch MIFOS product details with fallback to constants
        logger.info('Fetching product details from MIFOS for product code:', productCode);
        let productDetails = null;
        try {
            productDetails = await getProductDetails(productCode);
            if (productDetails) {
                logger.info('Successfully fetched product details from MIFOS:', {
                    name: productDetails.name,
                    interestRate: productDetails.nominalInterestRatePerPeriod,
                    maxPrincipal: productDetails.maxPrincipal,
                    minPrincipal: productDetails.minPrincipal,
                    maxNumberOfRepayments: productDetails.maxNumberOfRepayments
                });
            } else {
                logger.info('Product details not found in MIFOS, using fallback constants');
            }
        } catch (error) {
            logger.warn('Failed to fetch product details from MIFOS, using fallback constants:', error.message);
        }

        // Create LoanOfferDTO with appropriate affordability constraint
        const loanOfferDTO = {
            country: 'tanzania',
            institution: 'LBT',
            loanType: 'DAS',
            affordabilityType,
            productCode: productCode,
            totalDeduction: totalEmployeeDeduction || 0,
            basicSalary: basicSalary || 0,
            netSalary: netSalary || 0,
            loanAmount: Math.max(requestedAmount || 0, LOAN_CONSTANTS.MIN_LOAN_AMOUNT),
            tenure: calculatedTenure,
            employmentType: 'EMPLOYED_FULL_TIME',
            employerCode: '', // Not provided in request
            employerName: '', // Not provided in request
            newLoanOfferExpected: true,
            centralRegAffordability: desirableEMI, // Always use customer's DesiredDeductibleAmount (capped at max affordability)
            // Add MIFOS product parameters with fallback to constants
            productDetails: productDetails || {
                interestRate: LOAN_CONSTANTS.DEFAULT_INTEREST_RATE,
                maxPrincipal: LOAN_CONSTANTS.MAX_LOAN_AMOUNT,
                minPrincipal: LOAN_CONSTANTS.TEST_LOAN_AMOUNT,
                maxNumberOfRepayments: LOAN_CONSTANTS.MAX_TENURE,
                interestRateFrequencyType: { id: 3 }, // Monthly
                interestCalculationPeriodType: { id: 1 }, // Same as repayment period
                amortizationType: { id: 1 }, // Equal installments
                interestType: { id: 0 } // Declining balance
            }
        };

        // Get customer number and ID using real MIFOS API with NIN
        const customer = await searchClientByExternalId(data.nin || checkNumber);

        if (customer) {
            loanOfferDTO.customerNumber = customer.accountNo;
            loanOfferDTO.newLoanOfferExpected = false;
            loanOfferDTO.customerId = customer.id;

            // Check existing loans using real CBS API (max 1 loan per customer)
            const existingLoans = await getClientLoans(customer.id);
            const activeLoans = existingLoans.filter(loan => loan.status.id === 300); // Active loans

            if (activeLoans.length > 0) {
                const existingLoan = activeLoans[0]; // Max 1 loan per customer

                // Calculate payoff amount (minimum borrow requirement)
                const payoffAmount = calculatePayoffAmount(existingLoan);
                loanOfferDTO.minimumBorrowAmount = payoffAmount;
                loanOfferDTO.hasExistingLoan = true;

                // Validate minimum amount against payoff amount
                if (requestedAmount && requestedAmount < payoffAmount) {
                    logger.warn(`Requested amount ${requestedAmount} is less than required payoff amount ${payoffAmount}`);
                    throw new ApplicationException(
                        LOAN_CONSTANTS.ERROR_CODES.INVALID_AMOUNT,
                        `Loan amount must be at least ${payoffAmount} to cover existing loan payoff`
                    );
                }
            }

            // Check if customer is active (keeping existing logic)
            await eligibilityService.isActiveCBSCustomer('tanzania', loanOfferDTO.customerNumber);

            // Check for existing loans
            const loanAccounts = await activeLoanProvider.enquireLoanAccount('tanzania', loanOfferDTO.customerNumber);

            if (loanAccounts?.accountDetailList && loanAccounts.accountDetailList.length > 0) {
                const activeAccount = loanAccounts.accountDetailList.find(account =>
                    account.accountStatus === 'FULL' || account.accountStatus === 'PART'
                );

                if (activeAccount?.accountNumber) {
                    const loanDetail = await activeLoanProvider.viewActiveLoanDetail('tanzania', activeAccount.accountNumber);

                    if (loanDetail.isPositiveArrears() && loanDetail.dayArr > LOAN_CONSTANTS.NPA_LOAN_ARR_DAYS) {
                        logger.warn(`Loan account ${activeAccount.accountNumber} is NPA for customer ${loanOfferDTO.customerNumber}`);
                        try {
                            await possibleLoanChargesEntity.updateOne({
                                status: 'FAILED',
                                errorMessage: 'Customer has NPA loan'
                            });
                        } catch (dbError) {
                            logger.warn('Failed to update entity status:', dbError.message);
                        }
                        throw new ApplicationException(LOAN_CONSTANTS.ERROR_CODES.NOT_ELIGIBLE, 'Customer has NPA loan');
                    }

                    loanOfferDTO.accountNumber = activeAccount.accountNumber;
                }
            }
        }

        // Save offer request
        try {
            await possibleLoanChargesEntity.updateOne({
                offerRequest: JSON.stringify(loanOfferDTO)
            });
        } catch (dbError) {
            logger.warn('Failed to save offer request to database:', dbError.message);
        }

        logger.info('Getting loan offer from eligibility service...');
        const loanOffer = await eligibilityService.getOffer(loanOfferDTO, true);

        // Update loan offer with additional data
        loanOffer.loanOffer.maxEligibleAmount = loanOffer.loanOffer.maximumAmount || 0;
        loanOffer.loanOffer.maxEligibleTerm = loanOffer.loanOffer.maximumTerm || 0;
        loanOffer.loanOffer.baseTotalLoanAmount = loanOffer.loanOffer.totalLoanAmount || 0;

        // Check if we need forward offer (when reverse was used but requested amount is provided)
        if (affordabilityType === LOAN_CONSTANTS.AFFORDABILITY_TYPE.REVERSE && requestedAmount && requestedAmount > 0) {
            return await doForwardOffer(possibleLoanChargesEntity, loanOfferDTO, requestedAmount, loanOffer.loanOffer.product.loanTerm, desiredDeductibleAmount);
        }

        // Calculate response values
        const totalInterestAmount = loanOffer.loanOffer.totalInterestAmount;
        const safeTotalInterest = isNaN(totalInterestAmount) || totalInterestAmount === undefined ? 0 : Number(totalInterestAmount);
        const totalInterestRateAmount = (loanOffer.loanOffer.bpi || 0) + safeTotalInterest;

        // Ensure MonthlyReturnAmount never exceeds DesiredDeductibleAmount (final validation)
        const calculatedMonthlyEMI = loanOffer.loanOffer.product.totalMonthlyInst || 0;
        const customerDesiredEMI = parseFloat(desiredDeductibleAmount) || 0;
        const finalMonthlyEMI = customerDesiredEMI > 0 
            ? Math.min(calculatedMonthlyEMI, customerDesiredEMI)
            : calculatedMonthlyEMI;

        // Log if capping occurred for debugging
        if (calculatedMonthlyEMI > customerDesiredEMI && customerDesiredEMI > 0) {
            logger.warn(`🔧 Final EMI capping: ${calculatedMonthlyEMI} → ${finalMonthlyEMI} (capped at DesiredDeductibleAmount: ${customerDesiredEMI})`);
        }

        const tenureValue = loanOffer.loanOffer.product.loanTerm || 0;

        const response = {
            monthlyReturnAmount: finalMonthlyEMI.toFixed(2),
            tenure: tenureValue,
            totalAmountToPay: (finalMonthlyEMI * tenureValue).toFixed(2),
            netLoanAmount: (loanOffer.loanOffer.product.loanAmount || 0).toFixed(2),
            eligibleAmount: (loanOffer.loanOffer.product.loanAmount || 0).toFixed(2),
            totalInterestRateAmount: totalInterestRateAmount.toFixed(2),
            totalProcessingFees: (loanOffer.loanOffer.adminFee || 0).toFixed(2),
            totalInsurance: (loanOffer.loanOffer.insurance?.oneTimeAmount || 0).toFixed(2),
            otherCharges: "0.00",
            desiredDeductibleAmount: desiredDeductibleAmount?.toString() || "0.00"
        };

        // Save response
        try {
            await possibleLoanChargesEntity.updateOne({
                response: JSON.stringify(response),
                status: 'COMPLETED'
            });
        } catch (dbError) {
            logger.warn('Failed to save response to database:', dbError.message);
        }

        return response;

    } catch (error) {
        logger.error('Exception in LoanCalculate:', error);

        if (error instanceof ApplicationException) {
            throw error;
        }

        if (error.message?.toLowerCase().includes('not eligible')) {
            throw new ApplicationException(LOAN_CONSTANTS.ERROR_CODES.NOT_ELIGIBLE, 'Customer is not eligible');
        }

        throw new ApplicationException(LOAN_CONSTANTS.ERROR_CODES.INTERNAL_ERROR, error.message || 'Internal error occurred');
    }
};

/**
 * Handle forward offer calculation when needed
 */
async function doForwardOffer(possibleLoanChargesEntity, loanOfferDTO, requestedAmount, term, desiredDeductibleAmount) {
    logger.info('Performing forward offer calculation...');

    loanOfferDTO.affordabilityType = LOAN_CONSTANTS.AFFORDABILITY_TYPE.FORWARD;
    loanOfferDTO.loanAmount = requestedAmount;
    loanOfferDTO.tenure = term;

    try {
        await possibleLoanChargesEntity.updateOne({
            offerRequest: JSON.stringify(loanOfferDTO)
        });
    } catch (dbError) {
        logger.warn('Failed to save forward offer request:', dbError.message);
    }

    const forwardLoanOffer = await eligibilityService.getOffer(loanOfferDTO);

    try {
        await possibleLoanChargesEntity.updateOne({
            offerData: JSON.stringify(forwardLoanOffer)
        });
    } catch (dbError) {
        logger.warn('Failed to save forward offer data:', dbError.message);
    }

    if (!forwardLoanOffer?.loanOffer?.product) {
        try {
            await possibleLoanChargesEntity.updateOne({
                status: 'FAILED',
                errorMessage: 'Customer is not eligible with forward offer'
            });
        } catch (dbError) {
            logger.warn('Failed to update entity status:', dbError.message);
        }
        throw new ApplicationException(LOAN_CONSTANTS.ERROR_CODES.NOT_ELIGIBLE, 'Customer is not eligible with forward offer');
    }

    // Update forward offer with additional data
    forwardLoanOffer.loanOffer.maxEligibleAmount = forwardLoanOffer.loanOffer.maximumAmount || 0;
    forwardLoanOffer.loanOffer.maxEligibleTerm = forwardLoanOffer.loanOffer.maximumTerm || 0;
    forwardLoanOffer.loanOffer.baseTotalLoanAmount = forwardLoanOffer.loanOffer.totalLoanAmount || 0;

    const forwardTotalInterest = forwardLoanOffer.loanOffer.totalInterestAmount;
    const safeForwardTotalInterest = isNaN(forwardTotalInterest) || forwardTotalInterest === undefined ? 0 : Number(forwardTotalInterest);
    const totalInterestRateAmount = (forwardLoanOffer.loanOffer.bpi || 0) + safeForwardTotalInterest;

    // Ensure MonthlyReturnAmount never exceeds DesiredDeductibleAmount (final validation for forward loans)
    const calculatedMonthlyEMI = forwardLoanOffer.loanOffer.product.totalMonthlyInst || 0;
    const customerDesiredEMI = parseFloat(desiredDeductibleAmount) || 0;
    const finalMonthlyEMI = customerDesiredEMI > 0 
        ? Math.min(calculatedMonthlyEMI, customerDesiredEMI)
        : calculatedMonthlyEMI;

    // Log if capping occurred for debugging
    if (calculatedMonthlyEMI > customerDesiredEMI && customerDesiredEMI > 0) {
        logger.warn(`🔧 Final EMI capping (Forward): ${calculatedMonthlyEMI} → ${finalMonthlyEMI} (capped at DesiredDeductibleAmount: ${customerDesiredEMI})`);
    }

    const tenureValue = forwardLoanOffer.loanOffer.product.loanTerm || 0;

    const response = {
        monthlyReturnAmount: finalMonthlyEMI.toFixed(2),
        tenure: tenureValue,
        totalAmountToPay: (finalMonthlyEMI * tenureValue).toFixed(2),
        netLoanAmount: (forwardLoanOffer.loanOffer.product.loanAmount || 0).toFixed(2),
        eligibleAmount: (forwardLoanOffer.loanOffer.product.loanAmount || 0).toFixed(2),
        totalInterestRateAmount: totalInterestRateAmount.toFixed(2),
        totalProcessingFees: (forwardLoanOffer.loanOffer.adminFee || 0).toFixed(2),
        totalInsurance: (forwardLoanOffer.loanOffer.insurance?.oneTimeAmount || 0).toFixed(2),
        otherCharges: "0.00",
        desiredDeductibleAmount: desiredDeductibleAmount?.toString() || "0.00"
    };

    try {
        await possibleLoanChargesEntity.updateOne({
            response: JSON.stringify(response),
            status: 'COMPLETED'
        });
    } catch (dbError) {
        logger.warn('Failed to save forward response:', dbError.message);
    }

    return response;
}

const CreateTopUpLoanOffer = async (data) => {
    try {
        const {
            checkNumber, // Now mandatory
            existingLoanNumber,
            firstName,
            middleName,
            lastName,
            nin, // Used as external ID
            mobileNo,
            sex,
            dateOfBirth,
            employmentDate,
            bankAccountNumber,
            swiftCode,
            requestedTopUpAmount,
            productCode,
            interestRate,
            tenure,
            processingFee,
            insurance,
            fspCode
        } = data;

        // Validate mandatory check number
        if (!checkNumber) {
            throw new Error('CheckNumber is mandatory for client onboarding');
        }

        logger.info('Creating top-up loan offer for:', { checkNumber, existingLoanNumber, nin });

        // 1. Check if client exists, if not create client
        let clientExists = false;
        let clientId = null;
        
        try {
            const clientSearch = await api.get(`/v1/clients?externalId=${nin}`);
            logger.info('Client search response status:', clientSearch.status);
            logger.info('Client search response:', JSON.stringify(clientSearch.response, null, 2));
            clientExists = clientSearch.status && clientSearch.response && clientSearch.response.pageItems && clientSearch.response.pageItems.length > 0;
            if (clientExists) {
                clientId = clientSearch.response.pageItems[0].id;
                logger.info('Found existing client with ID:', clientId);
            } else {
                logger.info('Client not found, will create new client');
            }
        } catch (error) {
            logger.info('Client search failed with error:', error.message, 'will create new client');
        }

        if (!clientExists) {
            logger.info('Creating new client in MIFOS...');
            
            // Format phone number with country code 255
            const formattedMobile = mobileNo ? (mobileNo.startsWith('+') ? mobileNo : `+255${mobileNo.replace(/^0/, '')}`) : null;
            
            // Map gender (now configured in MIFOS)
            const genderMapping = { 'M': 15, 'F': 16 }; // M=15, F=16 (MIFOS zedone-uat codes)
            const genderId = genderMapping[sex] || null;
            
            // Create client payload with all required fields
            const clientPayload = {
                firstname: firstName,
                lastname: lastName,
                middlename: middleName || '', // Handle missing middle names gracefully
                externalId: nin, // Use NIN as unique external identifier
                dateOfBirth: dateOfBirth, // Ensure YYYY-MM-DD format
                mobileNo: formattedMobile,
                genderId: genderId,
                officeId: 1, // Head Office
                activationDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
                submittedOnDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
                dateFormat: 'yyyy-MM-dd', // Required format parameter
                locale: 'en', // Required locale parameter
                legalFormId: 1, // Person
                clientTypeId: 17, // Retail client type (valid for zedone-uat tenant)
                isStaff: false
            };

            const clientResponse = await api.post('/v1/clients', clientPayload);
            if (!clientResponse.status) {
                throw new Error('Failed to create client: ' + JSON.stringify(clientResponse.response));
            }
            
            clientId = clientResponse.response.clientId;
            logger.info('✅ Client created successfully:', clientId);
            
            // 2. Add client onboarding datatable data
            // Format employment date to MIFOS expected format: "dd MMMM yyyy"
            const formatEmploymentDate = (dateString) => {
                if (!dateString) return null;
                const date = new Date(dateString);
                const day = date.getDate();
                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                                  'July', 'August', 'September', 'October', 'November', 'December'];
                const month = monthNames[date.getMonth()];
                const year = date.getFullYear();
                return `${day} ${month} ${year}`;
            };

            const onboardingData = {
                dateFormat: 'dd MMMM yyyy',
                locale: 'en',
                EmploymentDate: formatEmploymentDate(employmentDate), // Convert to "dd MMMM yyyy" format
                SwiftCode: swiftCode,
                BankAccountNumber: bankAccountNumber,
                CheckNumber: checkNumber // Mandatory field
            };
            
            logger.info('Inserting client onboarding data:', onboardingData);
            
            try {
                const datatableResponse = await api.post(`/v1/datatables/client_onboarding/${clientId}`, onboardingData);
                if (datatableResponse.status) {
                    logger.info('✅ Client onboarding data inserted successfully');
                } else {
                    logger.info('⚠️ Failed to insert onboarding data:', datatableResponse.message);
                    // Don't fail the entire process for datatable issues
                }
            } catch (datatableError) {
                logger.info('⚠️ Datatable insertion failed (datatable may not exist yet):', datatableError.message);
                // Continue with the process even if datatable fails
            }
            
        } else {
            logger.info('Client already exists with NIN:', nin, 'ID:', clientId);
        }

        // 3. Validate existing loan
        const existingLoanResponse = await api.get(`${API_ENDPOINTS.LOAN}${existingLoanNumber}`);
        if (!existingLoanResponse.status) {
            throw new Error('Existing loan not found in CBS');
        }

        const existingLoan = existingLoanResponse.response;
        logger.info('Existing loan found:', existingLoan.id);

        // 4. Get loan product details
        const productResponse = await api.get(`${API_ENDPOINTS.PRODUCT}/${productCode}`);
        if (!productResponse.status) {
            throw new Error('Loan product not found');
        }

        const product = productResponse.response;
        logger.info('Product details retrieved:', product.name);

        // 5. Calculate loan schedule
        const principal = requestedTopUpAmount;
        const annualInterestRate = interestRate;
        const numberOfInstallments = tenure;

        const monthlyInstallment = LoanCalculations.calculateEMI(principal, annualInterestRate, numberOfInstallments);

        const totalPayable = monthlyInstallment * numberOfInstallments;
        const totalInterest = totalPayable - principal;

        logger.info('Calculated loan terms:', {
            principal,
            monthlyInstallment: monthlyInstallment.toFixed(2),
            totalPayable: totalPayable.toFixed(2),
            totalInterest: totalInterest.toFixed(2)
        });

        // 6. Return offer details
        const offerResult = {
            loanId: `TOPUP_${Date.now()}`,
            offeredAmount: principal,
            monthlyInstallment: monthlyInstallment.toFixed(2),
            totalPayable: totalPayable.toFixed(2),
            interestRate: annualInterestRate,
            tenure: numberOfInstallments,
            processingFee: processingFee,
            insurance: insurance,
            clientCreated: !clientExists,
            clientId: clientId
        };

        logger.info('Top-up loan offer created:', offerResult);
        return offerResult;

    } catch (error) {
        logger.error('CreateTopUpLoanOffer error:', error);
        throw error;
    }
}


const CreateTakeoverLoanOffer = async (data) => {
    try {
        const {
            checkNumber,
            existingLoanNumber,
            firstName,
            middleName,
            lastName,
            nin,
            mobileNo,
            sex,
            dateOfBirth,
            employmentDate,
            bankAccountNumber,
            swiftCode,
            requestedTakeoverAmount,
            productCode,
            interestRate,
            tenure,
            processingFee,
            insurance,
            fspCode
        } = data;

        if (!checkNumber) {
            throw new Error('CheckNumber is mandatory for client onboarding');
        }

        logger.info('Creating takeover loan offer for:', { checkNumber, existingLoanNumber, nin });

        // 1. Check if client exists, if not create client
        let clientExists = false;
        let clientId = null;
        
        try {
            const clientSearch = await api.get(`/v1/clients?externalId=${nin}`);
            logger.info('Client search response status:', clientSearch.status);
            logger.info('Client search response:', JSON.stringify(clientSearch.response, null, 2));
            clientExists = clientSearch.status && clientSearch.response && clientSearch.response.pageItems && clientSearch.response.pageItems.length > 0;
            if (clientExists) {
                clientId = clientSearch.response.pageItems[0].id;
                logger.info('Found existing client with ID:', clientId);
            } else {
                logger.info('Client not found, will create new client');
            }
        } catch (error) {
            logger.info('Client search failed with error:', error.message, 'will create new client');
        }

        if (!clientExists) {
            logger.info('Creating new client in MIFOS...');
            
            const formattedMobile = mobileNo ? (mobileNo.startsWith('+') ? mobileNo : `+255${mobileNo.replace(/^0/, '')}`) : null;
            const genderMapping = { 'M': 15, 'F': 16 }; // M=15, F=16 (MIFOS zedone-uat codes)
            const genderId = genderMapping[sex] || null;
            
            const clientPayload = {
                firstname: firstName,
                lastname: lastName,
                middlename: middleName || '',
                externalId: nin,
                dateOfBirth: dateOfBirth,
                mobileNo: formattedMobile,
                genderId: genderId,
                officeId: 1,
                activationDate: new Date().toISOString().split('T')[0],
                submittedOnDate: new Date().toISOString().split('T')[0],
                dateFormat: 'yyyy-MM-dd', // Required format parameter
                locale: 'en', // Required locale parameter
                legalFormId: 1,
                clientTypeId: 17, // Retail client type (valid for zedone-uat tenant)
                isStaff: false
            };

            const clientResponse = await api.post('/v1/clients', clientPayload);
            if (!clientResponse.status) {
                throw new Error('Failed to create client: ' + JSON.stringify(clientResponse.response));
            }
            
            clientId = clientResponse.response.clientId;
            logger.info('✅ Client created successfully:', clientId);
            
            // 2. Add client onboarding datatable data
            const formatEmploymentDate = (dateString) => {
                if (!dateString) return null;
                const date = new Date(dateString);
                const day = date.getDate();
                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                                  'July', 'August', 'September', 'October', 'November', 'December'];
                const month = monthNames[date.getMonth()];
                const year = date.getFullYear();
                return `${day} ${month} ${year}`;
            };

            const onboardingData = {
                dateFormat: 'dd MMMM yyyy',
                locale: 'en',
                EmploymentDate: formatEmploymentDate(employmentDate),
                SwiftCode: swiftCode,
                BankAccountNumber: bankAccountNumber,
                CheckNumber: checkNumber
            };
            
            logger.info('Inserting client onboarding data:', onboardingData);
            
            try {
                const datatableResponse = await api.post(`/v1/datatables/client_onboarding/${clientId}`, onboardingData);
                if (datatableResponse.status) {
                    logger.info('✅ Client onboarding data inserted successfully');
                } else {
                    logger.info('⚠️ Failed to insert onboarding data:', datatableResponse.message);
                }
            } catch (datatableError) {
                logger.info('⚠️ Datatable insertion failed (datatable may not exist yet):', datatableError.message);
            }
            
        } else {
            logger.info('Client already exists with NIN:', nin, 'ID:', clientId);
        }

        // 3. Validate existing loan for takeover
        const existingLoanResponse = await api.get(`${API_ENDPOINTS.LOAN}${existingLoanNumber}`);
        if (!existingLoanResponse.status) {
            throw new Error('Existing loan not found in CBS for takeover');
        }

        const existingLoan = existingLoanResponse.response;
        logger.info('Existing loan found for takeover:', existingLoan.id);

        // 4. Get loan product details
        const productResponse = await api.get(`${API_ENDPOINTS.PRODUCT}/${productCode}`);
        if (!productResponse.status) {
            throw new Error('Loan product not found');
        }

        const product = productResponse.response;
        logger.info('Product details retrieved for takeover:', product.name);

        // 5. Calculate takeover loan schedule
        const principal = requestedTakeoverAmount;
        const annualInterestRate = interestRate;
        const numberOfInstallments = tenure;

        const monthlyRate = annualInterestRate / 100 / 12;
        const monthlyInstallment = LoanCalculations.calculateEMI(principal, annualInterestRate, numberOfInstallments);

        const totalPayable = monthlyInstallment * numberOfInstallments;
        const totalInterest = totalPayable - principal;

        logger.info('Calculated takeover loan terms:', {
            principal,
            monthlyInstallment: monthlyInstallment.toFixed(2),
            totalPayable: totalPayable.toFixed(2),
            totalInterest: totalInterest.toFixed(2)
        });

        // 6. Return takeover offer details
        const offerResult = {
            loanId: `TAKEOVER_${Date.now()}`,
            offeredAmount: principal,
            monthlyInstallment: monthlyInstallment.toFixed(2),
            totalPayable: totalPayable.toFixed(2),
            interestRate: annualInterestRate,
            tenure: numberOfInstallments,
            processingFee: processingFee,
            insurance: insurance,
            clientCreated: !clientExists,
            clientId: clientId
        };

        logger.info('Takeover loan offer created:', offerResult);
        return offerResult;

    } catch (error) {
        logger.error('CreateTakeoverLoanOffer error:', error);
        throw error;
    }
}

const processTakeoverPayment = async (paymentData) => {
    try {
        logger.info('Processing takeover payment:', paymentData);

        const {
            loanId,
            disbursementAmount,
            disbursementDate,
            bankAccountNumber,
            swiftCode
        } = paymentData;

        // For takeover, we need to disburse the loan and handle the payment
        // This is similar to final approval but for takeover scenario
        
        // 1. Approve the loan if not already approved
        const approveResponse = await api.post(`${API_ENDPOINTS.LOAN}${loanId}?command=approve`, {
            approvedOnDate: disbursementDate,
            approvedLoanAmount: disbursementAmount,
            locale: 'en',
            dateFormat: 'yyyy-MM-dd'
        });

        if (!approveResponse.status) {
            throw new Error('Failed to approve takeover loan: ' + JSON.stringify(approveResponse.response));
        }

        logger.info('✅ Takeover loan approved successfully');

        // 2. Disburse the loan
        const disburseResponse = await api.post(`${API_ENDPOINTS.LOAN}${loanId}?command=disburse`, {
            actualDisbursementDate: disbursementDate,
            transactionAmount: disbursementAmount,
            locale: 'en',
            dateFormat: 'yyyy-MM-dd'
        });

        if (!disburseResponse.status) {
            throw new Error('Failed to disburse takeover loan: ' + JSON.stringify(disburseResponse.response));
        }

        logger.info('✅ Takeover loan disbursed successfully');

        return {
            success: true,
            loanId: loanId,
            disbursementAmount: disbursementAmount,
            disbursementDate: disbursementDate
        };

    } catch (error) {
        logger.error('processTakeoverPayment error:', error);
        throw error;
    }
}


const CreateLoanOffer = async (data) => {
    try {
        const {
            checkNumber,
            firstName,
            middleName,
            lastName,
            sex,
            employmentDate,
            maritalStatus,
            bankAccountNumber,
            voteCode,
            voteName,
            nin,
            designationCode,
            designationName,
            basicSalary,
            netSalary,
            oneThirdAmount,
            totalEmployeeDeduction,
            retirementDate,
            termsOfEmployment,
            requestedAmount,
            desiredDeductibleAmount,
            tenure,
            fspCode,
            productCode,
            physicalAddress,
            telephoneNumber,
            emailAddress,
            mobileNo,
            applicationNumber,
            loanPurpose,
            contractStartDate,
            contractEndDate,
            swiftCode
        } = data;

        // Validate mandatory fields
        if (!checkNumber) {
            throw new Error('CheckNumber is mandatory for loan offer');
        }
        if (!nin) {
            throw new Error('NIN is mandatory for loan offer');
        }
        if (!requestedAmount) {
            throw new Error('RequestedAmount is mandatory for loan offer');
        }

        logger.info('Calculating loan offer for:', { checkNumber, applicationNumber, nin, requestedAmount });

        // 1. Validate product exists with fallback logic
        let productId = productCode || 17; // Use provided productCode or default to 17
        logger.info('Requested product ID:', productId);

        // Get loan product details for validation and calculation
        let loanProduct;
        try {
            logger.info('Fetching product from:', API_ENDPOINTS.PRODUCT + '/' + productId);
            loanProduct = await api.get(API_ENDPOINTS.PRODUCT + '/' + productId);
            logger.info('Product API response status:', loanProduct.status);
            logger.info('Product API response:', JSON.stringify(loanProduct.response, null, 2));
        } catch (error) {
            logger.info('Product ID', productId, 'not found, error:', error.message, 'falling back to product ID 17');
            try {
                logger.info('Fetching fallback product from:', API_ENDPOINTS.PRODUCT + '/17');
                loanProduct = await api.get(API_ENDPOINTS.PRODUCT + '/17');
                logger.info('Fallback product API response status:', loanProduct.status);
                logger.info('Fallback product API response:', JSON.stringify(loanProduct.response, null, 2));
                productId = 17; // Update productId to the fallback
            } catch (fallbackError) {
                logger.info('Fallback product also failed:', fallbackError.message);
                throw fallbackError;
            }
        }

        const { response: productResponse, status: productStatus } = loanProduct;
        if (!productStatus) {
            logger.info('Product status is false, response:', productResponse);
            throw new Error(productResponse?.error || "Product not found");
        }

        logger.info('Loan product validated:', productResponse.name, '(ID:', productId, productId !== (productCode || 17) ? '- fallback used' : '', ')');

        // 2. Calculate loan terms using same method as LoanCalculate (no actual creation)
        const principal = requestedAmount;
        const numberOfRepayments = tenure || productResponse.numberOfRepayments || productResponse.maxNumberOfRepayments || 24;

        // Use same interest rate source as LoanCalculate
        const interestRate = productResponse.nominalInterestRatePerPeriod || productResponse.interestRatePerPeriod || LOAN_CONSTANTS?.DEFAULT_INTEREST_RATE || 2.5;

        // Calculate using same amortization formula as LoanCalculate/eligibility service
        const monthlyRate = interestRate / 100 / 12;
        const monthlyPayment = LoanCalculations.calculateEMI(principal, interestRate, numberOfRepayments);
        const totalAmount = monthlyPayment * numberOfRepayments;
        const totalInterest = totalAmount - principal;

        logger.info('Loan calculation (consistent with LOAN_CHARGES_REQUEST):', {
            principal,
            numberOfRepayments,
            interestRate,
            monthlyPayment,
            totalAmount,
            totalInterest
        });

        // 3. Return offer details (no client or loan created)
        const offerResult = {
            success: true,
            applicationNumber: applicationNumber,
            offeredAmount: principal,
            tenure: numberOfRepayments,
            productId: productId,
            monthlyPayment: monthlyPayment,
            totalAmount: totalAmount,
            totalInterest: totalInterest,
            interestRate: interestRate,
            fspReferenceNumber: `FSPREF${Date.now()}`,
            approvalStatus: 'APPROVED'
        };

        logger.info('Loan offer calculated:', offerResult);
        return offerResult;

    } catch (error) {
        logger.error('CreateLoanOffer error:', error);
        throw error;
    }
};


module.exports = {
    LoanCalculate,
    CreateTopUpLoanOffer,
    CreateTakeoverLoanOffer,
    CreateLoanOffer,
    processTakeoverPayment
}