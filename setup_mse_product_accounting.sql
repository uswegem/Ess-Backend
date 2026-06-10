-- Setup GL Account Mappings for 3 MSE Products (IDs: 18, 19, 20)
-- Based on existing product 1 mappings

-- Product 18: MSE Purchase Order Finance (MPOF)
INSERT INTO credit_connect_db.acc_product_mapping (gl_account_id, product_id, product_type, payment_type, charge_id, financial_account_type, charge_off_reason_id) VALUES
(148, 18, 1, NULL, NULL, 1, NULL),  -- Fund source: Stanbic-IC
(146, 18, 1, NULL, NULL, 2, NULL),  -- Loan Portfolio: Advances to Customers
(186, 18, 1, NULL, NULL, 10, NULL), -- Transfer in suspense: Technical Contra
(184, 18, 1, NULL, NULL, 7, NULL),  -- Loan Receivable - Non Performing
(190, 18, 1, NULL, NULL, 8, NULL),  -- Interest Receivable - Write-Off
(190, 18, 1, NULL, NULL, 9, NULL),  -- Fees Receivable - Write-Off
(5, 18, 1, NULL, NULL, 3, NULL),    -- Income from Interest: Interest income - earned
(16, 18, 1, NULL, NULL, 4, NULL),   -- Income from Fees: Fee income - admin fee
(8, 18, 1, NULL, NULL, 5, NULL),    -- Income from Penalties: Interest income - penalty interest
(5, 18, 1, NULL, NULL, 12, NULL),   -- Income from Recovery Repayments
(5, 18, 1, NULL, NULL, 15, NULL),   -- Income from Charge-Off Interest
(5, 18, 1, NULL, NULL, 14, NULL),   -- Income from Charge-Off Fees
(5, 18, 1, NULL, NULL, 18, NULL),   -- Income from Charge-Off Penalty
(5, 18, 1, NULL, NULL, 19, NULL),   -- Income from Goodwill Credit Interest
(5, 18, 1, NULL, NULL, 20, NULL),   -- Income from Goodwill Credit Fees
(5, 18, 1, NULL, NULL, 21, NULL),   -- Income from Goodwill Credit Penalty
(35, 18, 1, NULL, NULL, 6, NULL),   -- Losses written off: Bad Debts - Written Off
(36, 18, 1, NULL, NULL, 13, NULL),  -- Charge-off Expense: Operational Losses
(34, 18, 1, NULL, NULL, 16, NULL),  -- Impairment Expense: Impairment Expense - Portfolio
(37, 18, 1, NULL, NULL, 17, NULL);  -- Charge-off Fraud Expense: Operational Loss - Fraud

-- Product 19: MSE Invoice Discounting (MIDF)
INSERT INTO credit_connect_db.acc_product_mapping (gl_account_id, product_id, product_type, payment_type, charge_id, financial_account_type, charge_off_reason_id) VALUES
(148, 19, 1, NULL, NULL, 1, NULL),  -- Fund source
(146, 19, 1, NULL, NULL, 2, NULL),  -- Loan Portfolio
(186, 19, 1, NULL, NULL, 10, NULL), -- Transfer in suspense
(184, 19, 1, NULL, NULL, 7, NULL),  -- Loan Receivable - Non Performing
(190, 19, 1, NULL, NULL, 8, NULL),  -- Interest Receivable - Write-Off
(190, 19, 1, NULL, NULL, 9, NULL),  -- Fees Receivable - Write-Off
(5, 19, 1, NULL, NULL, 3, NULL),    -- Income from Interest
(16, 19, 1, NULL, NULL, 4, NULL),   -- Income from Fees
(8, 19, 1, NULL, NULL, 5, NULL),    -- Income from Penalties
(5, 19, 1, NULL, NULL, 12, NULL),   -- Income from Recovery Repayments
(5, 19, 1, NULL, NULL, 15, NULL),   -- Income from Charge-Off Interest
(5, 19, 1, NULL, NULL, 14, NULL),   -- Income from Charge-Off Fees
(5, 19, 1, NULL, NULL, 18, NULL),   -- Income from Charge-Off Penalty
(5, 19, 1, NULL, NULL, 19, NULL),   -- Income from Goodwill Credit Interest
(5, 19, 1, NULL, NULL, 20, NULL),   -- Income from Goodwill Credit Fees
(5, 19, 1, NULL, NULL, 21, NULL),   -- Income from Goodwill Credit Penalty
(35, 19, 1, NULL, NULL, 6, NULL),   -- Losses written off
(36, 19, 1, NULL, NULL, 13, NULL),  -- Charge-off Expense
(34, 19, 1, NULL, NULL, 16, NULL),  -- Impairment Expense
(37, 19, 1, NULL, NULL, 17, NULL);  -- Charge-off Fraud Expense

-- Product 20: MSE Working Capital Finance (MWCF)
INSERT INTO credit_connect_db.acc_product_mapping (gl_account_id, product_id, product_type, payment_type, charge_id, financial_account_type, charge_off_reason_id) VALUES
(148, 20, 1, NULL, NULL, 1, NULL),  -- Fund source
(146, 20, 1, NULL, NULL, 2, NULL),  -- Loan Portfolio
(186, 20, 1, NULL, NULL, 10, NULL), -- Transfer in suspense
(184, 20, 1, NULL, NULL, 7, NULL),  -- Loan Receivable - Non Performing
(190, 20, 1, NULL, NULL, 8, NULL),  -- Interest Receivable - Write-Off
(190, 20, 1, NULL, NULL, 9, NULL),  -- Fees Receivable - Write-Off
(5, 20, 1, NULL, NULL, 3, NULL),    -- Income from Interest
(16, 20, 1, NULL, NULL, 4, NULL),   -- Income from Fees
(8, 20, 1, NULL, NULL, 5, NULL),    -- Income from Penalties
(5, 20, 1, NULL, NULL, 12, NULL),   -- Income from Recovery Repayments
(5, 20, 1, NULL, NULL, 15, NULL),   -- Income from Charge-Off Interest
(5, 20, 1, NULL, NULL, 14, NULL),   -- Income from Charge-Off Fees
(5, 20, 1, NULL, NULL, 18, NULL),   -- Income from Charge-Off Penalty
(5, 20, 1, NULL, NULL, 19, NULL),   -- Income from Goodwill Credit Interest
(5, 20, 1, NULL, NULL, 20, NULL),   -- Income from Goodwill Credit Fees
(5, 20, 1, NULL, NULL, 21, NULL),   -- Income from Goodwill Credit Penalty
(35, 20, 1, NULL, NULL, 6, NULL),   -- Losses written off
(36, 20, 1, NULL, NULL, 13, NULL),  -- Charge-off Expense
(34, 20, 1, NULL, NULL, 16, NULL),  -- Impairment Expense
(37, 20, 1, NULL, NULL, 17, NULL);  -- Charge-off Fraud Expense
