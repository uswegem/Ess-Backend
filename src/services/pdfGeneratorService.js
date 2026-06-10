const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const { maker } = require('./cbs.api');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

// MSE Product IDs that require automatic PDF generation
const MSE_PRODUCT_IDS = [18, 19, 20]; // MPOF, MIDF, MWCF

// Template IDs
const TEMPLATES = {
    FACILITY_LETTER: 1,
    LOAN_AGREEMENT: 2
};

/**
 * PDF Generator Service
 * Generates loan documents (Facility Letter, Loan Agreement) after loan approval
 */
class PdfGeneratorService {
    constructor() {
        this.pdfOutputDir = process.env.PDF_OUTPUT_DIR || './generated-documents';
        this.ensureOutputDirectory();
    }

    /**
     * Ensure the output directory exists
     */
    async ensureOutputDirectory() {
        try {
            await fs.mkdir(this.pdfOutputDir, { recursive: true });
            logger.info(`📁 PDF output directory ready: ${this.pdfOutputDir}`);
        } catch (error) {
            logger.error('Failed to create PDF output directory:', error);
        }
    }

    /**
     * Check if loan product requires PDF generation
     */
    isMseProduct(productId) {
        return MSE_PRODUCT_IDS.includes(Number(productId));
    }

    /**
     * Generate loan documents after approval
     * @param {Object} loanData - Loan details from webhook or API
     */
    async generateLoanDocuments(loanData) {
        try {
            const { loanId, productId, productName, clientId, clientName, loanAccountNo } = loanData;

            // Check if this is an MSE product
            if (!this.isMseProduct(productId)) {
                logger.info(`⏭️ Skipping PDF generation - Product ${productId} is not an MSE product`);
                return null;
            }

            logger.info(`📄 Starting PDF generation for loan ${loanAccountNo}`, {
                loanId,
                productId,
                productName,
                clientName
            });

            // Fetch complete loan details from MIFOS
            const loanDetails = await this.fetchLoanDetails(loanId);
            if (!loanDetails) {
                throw new Error(`Failed to fetch loan details for loanId: ${loanId}`);
            }

            // Generate both documents
            const results = await Promise.allSettled([
                this.generateDocument(loanDetails, TEMPLATES.FACILITY_LETTER, 'Facility_Letter'),
                this.generateDocument(loanDetails, TEMPLATES.LOAN_AGREEMENT, 'Loan_Agreement')
            ]);

            const documents = {
                facilityLetter: results[0].status === 'fulfilled' ? results[0].value : null,
                loanAgreement: results[1].status === 'fulfilled' ? results[1].value : null
            };

            // Log any failures
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    logger.error(`Failed to generate document ${index + 1}:`, result.reason);
                }
            });

            logger.info(`✅ PDF generation completed for loan ${loanAccountNo}`, {
                facilityLetter: documents.facilityLetter?.filename || 'failed',
                loanAgreement: documents.loanAgreement?.filename || 'failed'
            });

            return documents;

        } catch (error) {
            logger.error('❌ Error generating loan documents:', error);
            throw error;
        }
    }

    /**
     * Fetch complete loan details from MIFOS
     */
    async fetchLoanDetails(loanId) {
        try {
            const response = await maker.get(`/v1/loans/${loanId}?associations=all`);
            return response.data;
        } catch (error) {
            logger.error(`Failed to fetch loan details for ${loanId}:`, error);
            return null;
        }
    }

    /**
     * Fetch client details from MIFOS
     */
    async fetchClientDetails(clientId) {
        try {
            const response = await maker.get(`/v1/clients/${clientId}`);
            return response.data;
        } catch (error) {
            logger.error(`Failed to fetch client details for ${clientId}:`, error);
            return null;
        }
    }

    /**
     * Generate a specific document using MIFOS template
     * @param {Object} loanDetails - Complete loan data
     * @param {number} templateId - Template ID
     * @param {string} documentType - Type name for filename
     */
    async generateDocument(loanDetails, templateId, documentType) {
        try {
            // Build template data with loan and client details
            const templateData = this.buildTemplateData(loanDetails);

            // Render template with MIFOS API (for HTML version)
            let renderedHtml = '';
            try {
                renderedHtml = await this.renderTemplate(templateId, templateData);
            } catch (error) {
                logger.warn('Template rendering failed, using PDF-lib directly');
            }

            // Convert to PDF using pdf-lib
            const pdfBuffer = await this.htmlToPdf(renderedHtml, templateData, documentType);

            // Save PDF to file
            const filename = `${documentType}_${loanDetails.accountNo}_${Date.now()}.pdf`;
            const filepath = path.join(this.pdfOutputDir, filename);
            await fs.writeFile(filepath, pdfBuffer);

            // Also store in MIFOS as loan document
            await this.attachToLoan(loanDetails.id, pdfBuffer, filename, documentType);

            logger.info(`📄 Generated: ${filename}`);

            return {
                filename,
                filepath,
                size: pdfBuffer.length,
                generatedAt: new Date().toISOString()
            };

        } catch (error) {
            logger.error(`Failed to generate ${documentType}:`, error);
            throw error;
        }
    }

    /**
     * Build template data from loan details
     */
    buildTemplateData(loanDetails) {
        const client = loanDetails.clientName || '';
        const timeline = loanDetails.timeline || {};
        
        // Calculate total repayment and installment
        const repaymentSchedule = loanDetails.repaymentSchedule?.periods || [];
        const totalRepayment = repaymentSchedule.reduce((sum, p) => sum + (p.totalDueForPeriod || 0), 0);
        const totalInterest = repaymentSchedule.reduce((sum, p) => sum + (p.interestDue || 0), 0);
        
        // Get first repayment period for installment amount
        const firstRepaymentPeriod = repaymentSchedule.find(p => p.period > 0);
        const installmentAmount = firstRepaymentPeriod?.totalDueForPeriod || 0;

        return {
            // Loan details
            loanAccountNo: loanDetails.accountNo,
            principal: this.formatCurrency(loanDetails.principal || loanDetails.approvedPrincipal),
            principalInWords: this.numberToWords(loanDetails.principal || loanDetails.approvedPrincipal),
            currencyCode: loanDetails.currency?.code || 'BWP',
            numberOfRepayments: loanDetails.numberOfRepayments,
            repaymentFrequencyType: this.getFrequencyType(loanDetails.repaymentFrequencyType?.id),
            interestRatePerPeriod: loanDetails.interestRatePerPeriod,
            interestRateFrequencyType: this.getFrequencyType(loanDetails.interestRateFrequencyType?.id),
            installmentAmount: this.formatCurrency(installmentAmount),
            totalInterest: this.formatCurrency(totalInterest),
            totalRepayment: this.formatCurrency(totalRepayment),
            totalRepaymentInWords: this.numberToWords(totalRepayment),
            
            // Dates
            approvedOnDate: this.formatDate(timeline.approvedOnDate),
            expectedDisbursementDate: this.formatDate(timeline.expectedDisbursementDate),
            expectedFirstRepaymentDate: this.formatDate(loanDetails.expectedFirstRepaymentOnDate),
            expectedMaturityDate: this.formatDate(timeline.expectedMaturityDate),
            
            // Client details
            clientId: loanDetails.clientId,
            clientName: client,
            clientIdentifier: loanDetails.clientExternalId || '',
            employerName: loanDetails.clientOfficeId ? `Office ${loanDetails.clientOfficeId}` : '',
            
            // Bank details (would come from client additional info)
            bankName: '',
            accountNumber: '',
            
            // Fees
            arrangementFee: '1',
            insuranceFee: '0.254',
            
            // Product details
            productId: loanDetails.loanProductId,
            productName: loanDetails.loanProductName,
            
            // Guarantor (if exists)
            guarantorName: loanDetails.guarantors?.[0]?.name || ''
        };
    }

    /**
     * Render template using MIFOS template API
     */
    async renderTemplate(templateId, data) {
        try {
            // First try MIFOS template API
            const response = await maker.post(`/v1/templates/${templateId}`, data, {
                params: { command: 'render' }
            });
            return response.data;
        } catch (error) {
            // If MIFOS template API fails, fetch template and render manually
            logger.warn('MIFOS template API failed, using manual rendering');
            return await this.renderTemplateManually(templateId, data);
        }
    }

    /**
     * Manually render template by fetching from database and replacing placeholders
     */
    async renderTemplateManually(templateId, data) {
        try {
            const response = await maker.get(`/v1/templates/${templateId}`);
            let html = response.data.text;

            // Replace Mustache-style placeholders
            for (const [key, value] of Object.entries(data)) {
                const regex = new RegExp(`{{${key}}}`, 'g');
                html = html.replace(regex, value || '');
            }

            // Handle conditional sections {{#key}}...{{/key}}
            html = html.replace(/{{#(\w+)}}([\s\S]*?){{\/\1}}/g, (match, key, content) => {
                return data[key] ? content : '';
            });

            return html;
        } catch (error) {
            logger.error('Failed to render template manually:', error);
            throw error;
        }
    }

    /**
     * Convert HTML to PDF using pdf-lib
     * Note: pdf-lib doesn't render HTML directly, so we create a formatted PDF
     */
    async htmlToPdf(html, templateData, documentType) {
        try {
            const pdfDoc = await PDFDocument.create();
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            
            // Page settings
            const pageWidth = 595.28; // A4 width in points
            const pageHeight = 841.89; // A4 height in points
            const margin = 50;
            const lineHeight = 14;
            
            let page = pdfDoc.addPage([pageWidth, pageHeight]);
            let y = pageHeight - margin;
            
            const drawText = (text, options = {}) => {
                const { bold = false, size = 10, indent = 0 } = options;
                const selectedFont = bold ? boldFont : font;
                
                // Word wrap
                const maxWidth = pageWidth - (2 * margin) - indent;
                const words = text.split(' ');
                let line = '';
                
                for (const word of words) {
                    const testLine = line + (line ? ' ' : '') + word;
                    const testWidth = selectedFont.widthOfTextAtSize(testLine, size);
                    
                    if (testWidth > maxWidth && line) {
                        if (y < margin + lineHeight) {
                            page = pdfDoc.addPage([pageWidth, pageHeight]);
                            y = pageHeight - margin;
                        }
                        page.drawText(line, {
                            x: margin + indent,
                            y,
                            size,
                            font: selectedFont,
                            color: rgb(0, 0, 0)
                        });
                        y -= lineHeight;
                        line = word;
                    } else {
                        line = testLine;
                    }
                }
                
                if (line) {
                    if (y < margin + lineHeight) {
                        page = pdfDoc.addPage([pageWidth, pageHeight]);
                        y = pageHeight - margin;
                    }
                    page.drawText(line, {
                        x: margin + indent,
                        y,
                        size,
                        font: selectedFont,
                        color: rgb(0, 0, 0)
                    });
                    y -= lineHeight;
                }
            };
            
            const drawLine = () => {
                y -= 5;
                page.drawLine({
                    start: { x: margin, y },
                    end: { x: pageWidth - margin, y },
                    thickness: 0.5,
                    color: rgb(0.7, 0.7, 0.7)
                });
                y -= 10;
            };
            
            const addSpace = (lines = 1) => {
                y -= lineHeight * lines;
                if (y < margin + lineHeight) {
                    page = pdfDoc.addPage([pageWidth, pageHeight]);
                    y = pageHeight - margin;
                }
            };

            // Generate document based on type
            if (documentType === 'Facility_Letter') {
                await this.generateFacilityLetterPdf(drawText, drawLine, addSpace, templateData);
            } else {
                await this.generateLoanAgreementPdf(drawText, drawLine, addSpace, templateData);
            }
            
            const pdfBytes = await pdfDoc.save();
            return Buffer.from(pdfBytes);
            
        } catch (error) {
            logger.error('Error generating PDF:', error);
            // Fallback: save as HTML
            return Buffer.from(html, 'utf-8');
        }
    }

    /**
     * Generate Facility Letter PDF content
     */
    async generateFacilityLetterPdf(drawText, drawLine, addSpace, data) {
        // Header
        drawText('CREDITCONNECT FINANCIAL SERVICES BOTSWANA', { bold: true, size: 14 });
        drawText('CreditConnect Place, Box 381 Plot 22, Khama Crescent Gaborone, Botswana', { size: 9 });
        addSpace(2);
        
        drawText(`Date: ${data.approvedOnDate}`, { size: 10 });
        drawText(`Reference No: ${data.loanAccountNo}`, { size: 10 });
        addSpace(2);
        
        drawText('Dear Sir/Madam,', { size: 10 });
        addSpace();
        
        drawText('RE: FACILITY LETTER', { bold: true, size: 12 });
        drawLine();
        
        // Section 1
        drawText('1. Loan Facility', { bold: true, size: 11 });
        addSpace();
        drawText('We are pleased to offer you a loan facility (the "Facility") on the terms and conditions set out in this letter.', { size: 10 });
        addSpace();
        
        // Facility details table
        drawText(`Amount of Facility: ${data.currencyCode} ${data.principal}`, { size: 10, indent: 20 });
        drawText(`Term of Facility: ${data.numberOfRepayments} ${data.repaymentFrequencyType}`, { size: 10, indent: 20 });
        drawText(`Interest Rate: ${data.interestRatePerPeriod}% per ${data.interestRateFrequencyType}`, { size: 10, indent: 20 });
        drawText(`Total Repayment: ${data.currencyCode} ${data.totalRepayment}`, { size: 10, indent: 20 });
        addSpace(2);
        
        // Section 2
        drawText('2. Definitions', { bold: true, size: 11 });
        addSpace();
        drawText('"CreditConnect" means CreditConnect Financial Services Botswana (Pty) Ltd', { size: 10, indent: 20 });
        drawText(`"Borrower" means ${data.clientName}`, { size: 10, indent: 20 });
        addSpace(2);
        
        // Section 3
        drawText('3. Interest', { bold: true, size: 11 });
        addSpace();
        drawText(`Interest will be charged at ${data.interestRatePerPeriod}% per ${data.interestRateFrequencyType} on the outstanding balance.`, { size: 10 });
        addSpace(2);
        
        // Section 4
        drawText('4. Repayment', { bold: true, size: 11 });
        addSpace();
        drawText(`Monthly Installment: ${data.currencyCode} ${data.installmentAmount}`, { size: 10, indent: 20 });
        drawText(`First Repayment Date: ${data.expectedFirstRepaymentDate}`, { size: 10, indent: 20 });
        drawText(`Maturity Date: ${data.expectedMaturityDate}`, { size: 10, indent: 20 });
        addSpace(2);
        
        // Fees
        drawText('5. Fees', { bold: true, size: 11 });
        addSpace();
        drawText(`Arrangement Fee: ${data.arrangementFee}% of principal`, { size: 10, indent: 20 });
        drawText(`Insurance Premium: ${data.insuranceFee}% of principal`, { size: 10, indent: 20 });
        addSpace(2);
        
        // Signature
        drawLine();
        addSpace(2);
        drawText('For and on behalf of CreditConnect Financial Services Botswana', { size: 10 });
        addSpace(3);
        drawText('_______________________________', { size: 10 });
        drawText('Authorized Signatory', { size: 10 });
        drawText(`Date: ${data.approvedOnDate}`, { size: 10 });
    }

    /**
     * Generate Loan Agreement PDF content
     */
    async generateLoanAgreementPdf(drawText, drawLine, addSpace, data) {
        // Header
        drawText('CREDITCONNECT FINANCIAL SERVICES BOTSWANA (PTY) LTD', { bold: true, size: 14 });
        addSpace();
        drawText('LOAN AGREEMENT FORM', { bold: true, size: 12 });
        drawLine();
        
        drawText(`Reference: ${data.loanAccountNo}`, { size: 10 });
        drawText(`Date: ${data.approvedOnDate}`, { size: 10 });
        addSpace(2);
        
        // Definitions
        drawText('1. DEFINITIONS', { bold: true, size: 11 });
        addSpace();
        drawText(`The Borrower: ${data.clientName}`, { size: 10, indent: 20 });
        drawText(`The Capital: ${data.currencyCode} ${data.principal}`, { size: 10, indent: 20 });
        drawText('The Lender: CreditConnect Financial Services Botswana (Pty) Ltd', { size: 10, indent: 20 });
        addSpace(2);
        
        // Loan details
        drawText('2. LOAN DETAILS', { bold: true, size: 11 });
        addSpace();
        drawText(`Loan Account Number: ${data.loanAccountNo}`, { size: 10, indent: 20 });
        drawText(`Principal Amount: ${data.currencyCode} ${data.principal}`, { size: 10, indent: 20 });
        drawText(`Interest Rate: ${data.interestRatePerPeriod}% per ${data.interestRateFrequencyType}`, { size: 10, indent: 20 });
        drawText(`Loan Term: ${data.numberOfRepayments} ${data.repaymentFrequencyType}`, { size: 10, indent: 20 });
        drawText(`Monthly Installment: ${data.currencyCode} ${data.installmentAmount}`, { size: 10, indent: 20 });
        drawText(`Total Interest: ${data.currencyCode} ${data.totalInterest}`, { size: 10, indent: 20 });
        drawText(`Total Repayment: ${data.currencyCode} ${data.totalRepayment}`, { size: 10, indent: 20 });
        addSpace(2);
        
        // Terms
        drawText('3. TERMS OF LOAN', { bold: true, size: 11 });
        addSpace();
        drawText('The Borrower acknowledges that he/she has applied for a loan from the Lender in the amount reflected above.', { size: 10 });
        addSpace();
        drawText('The Borrower agrees to repay the loan in equal monthly installments as per the schedule.', { size: 10 });
        addSpace();
        drawText('The Borrower authorises salary deductions for loan repayment.', { size: 10 });
        addSpace(2);
        
        // Fees
        drawText('4. FEES AND CHARGES', { bold: true, size: 11 });
        addSpace();
        drawText(`Arrangement Fee: ${data.arrangementFee}% of principal`, { size: 10, indent: 20 });
        drawText(`Insurance Premium: ${data.insuranceFee}% of principal`, { size: 10, indent: 20 });
        drawText('Early Settlement Penalty: 5% of outstanding balance or 3 months notice', { size: 10, indent: 20 });
        addSpace(2);
        
        // Declaration
        drawText('5. DECLARATION', { bold: true, size: 11 });
        addSpace();
        drawText('I have read, understood and consent to all clauses of this loan agreement.', { size: 10 });
        addSpace();
        drawText('This agreement shall be governed by the laws of Botswana.', { size: 10 });
        addSpace(2);
        
        // Signatures
        drawLine();
        addSpace(2);
        
        drawText('BORROWER:', { bold: true, size: 10 });
        addSpace(2);
        drawText('_______________________________', { size: 10 });
        drawText(`Name: ${data.clientName}`, { size: 10 });
        drawText('Date: _______________', { size: 10 });
        addSpace(2);
        
        drawText('FOR AND ON BEHALF OF THE LENDER:', { bold: true, size: 10 });
        addSpace(2);
        drawText('_______________________________', { size: 10 });
        drawText('CreditConnect Financial Services Botswana (Pty) Ltd', { size: 10 });
        drawText(`Date: ${data.approvedOnDate}`, { size: 10 });
    }

    /**
     * Attach generated document to loan in MIFOS
     */
    async attachToLoan(loanId, pdfBuffer, filename, documentType) {
        try {
            const FormData = require('form-data');
            const form = new FormData();
            form.append('file', pdfBuffer, { filename });
            form.append('name', documentType.replace('_', ' '));
            form.append('description', `Auto-generated ${documentType} on loan approval`);

            await maker.post(`/v1/loans/${loanId}/documents`, form, {
                headers: form.getHeaders()
            });

            logger.info(`📎 Attached ${documentType} to loan ${loanId}`);
        } catch (error) {
            // Non-fatal error - document is still saved locally
            logger.warn(`Failed to attach document to loan ${loanId}:`, error.message);
        }
    }

    /**
     * Format currency value
     */
    formatCurrency(value) {
        if (!value) return '0.00';
        return Number(value).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    /**
     * Format date
     */
    formatDate(dateArray) {
        if (!dateArray) return '';
        if (Array.isArray(dateArray)) {
            const [year, month, day] = dateArray;
            return `${day}/${month}/${year}`;
        }
        return new Date(dateArray).toLocaleDateString('en-GB');
    }

    /**
     * Get frequency type string
     */
    getFrequencyType(freqId) {
        const types = {
            0: 'day',
            1: 'week',
            2: 'month',
            3: 'year'
        };
        return types[freqId] || 'month';
    }

    /**
     * Convert number to words
     */
    numberToWords(num) {
        if (!num) return 'Zero';
        
        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
            'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        const scales = ['', 'Thousand', 'Million', 'Billion'];

        const numStr = Math.floor(num).toString();
        if (numStr === '0') return 'Zero';

        const groups = [];
        for (let i = numStr.length; i > 0; i -= 3) {
            groups.unshift(numStr.slice(Math.max(0, i - 3), i));
        }

        const words = groups.map((group, index) => {
            const n = parseInt(group);
            if (n === 0) return '';
            
            let word = '';
            if (n >= 100) {
                word += ones[Math.floor(n / 100)] + ' Hundred ';
            }
            const remainder = n % 100;
            if (remainder >= 20) {
                word += tens[Math.floor(remainder / 10)] + ' ';
                if (remainder % 10 > 0) word += ones[remainder % 10] + ' ';
            } else if (remainder > 0) {
                word += ones[remainder] + ' ';
            }
            
            const scale = scales[groups.length - 1 - index];
            if (scale) word += scale + ' ';
            
            return word;
        });

        return words.join('').trim();
    }
}

module.exports = new PdfGeneratorService();
