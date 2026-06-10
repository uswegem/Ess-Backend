-- SQL to create client onboarding datatable in MIFOS
-- Run this in your MIFOS database

-- 1. Create the datatable
INSERT INTO x_registered_table (registered_table_name, application_table_name, entity_subtype)
VALUES ('client_onboarding', 'm_client', '');

-- 2. Add columns to the datatable
-- Get the registered table ID
SET @table_id = (SELECT id FROM x_registered_table WHERE registered_table_name = 'client_onboarding');

-- EmploymentDate column
INSERT INTO x_registered_table_column (registered_table_id, name, type, length, mandatory, code)
VALUES (@table_id, 'EmploymentDate', 'DATE', NULL, 0, '');

-- SwiftCode column
INSERT INTO x_registered_table_column (registered_table_id, name, type, length, mandatory, code)
VALUES (@table_id, 'SwiftCode', 'VARCHAR', 20, 0, '');

-- BankAccountNumber column
INSERT INTO x_registered_table_column (registered_table_id, name, type, length, mandatory, code)
VALUES (@table_id, 'BankAccountNumber', 'VARCHAR', 20, 0, '');

-- CheckNumber column (MANDATORY)
INSERT INTO x_registered_table_column (registered_table_id, name, type, length, mandatory, code)
VALUES (@table_id, 'CheckNumber', 'VARCHAR', 15, 1, '');

-- 3. Verify the datatable was created
SELECT rt.registered_table_name, rtc.name, rtc.type, rtc.mandatory
FROM x_registered_table rt
JOIN x_registered_table_column rtc ON rt.id = rtc.registered_table_id
WHERE rt.registered_table_name = 'client_onboarding';

-- Note: After running this SQL, restart your MIFOS application server
-- The datatable will then be available via the API at:
-- GET /v1/datatables/client_onboarding/{clientId}
-- POST /v1/datatables/client_onboarding/{clientId}