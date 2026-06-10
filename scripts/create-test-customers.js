/**
 * Script to create 100 random Tanzanian customers with savings accounts
 * Run from server: node scripts/create-test-customers.js
 */

const axios = require('axios');

// MIFOS Configuration
const MIFOS_BASE_URL = 'https://zedone-uat.miracore.co.tz/fineract-provider/api/v1';
const TENANT_ID = 'zedone-uat';
const USERNAME = 'ess_creater';
const PASSWORD = 'Jothanum@123456';

// Tanzanian first names
const FIRST_NAMES_MALE = [
  'Juma', 'Hassan', 'Baraka', 'Emmanuel', 'Joseph', 'Peter', 'John', 'James', 'Michael', 'Daniel',
  'David', 'Robert', 'Charles', 'George', 'William', 'Richard', 'Thomas', 'Christopher', 'Anthony', 'Andrew',
  'Rashid', 'Hamisi', 'Salum', 'Selemani', 'Ally', 'Omari', 'Bakari', 'Musa', 'Ibrahim', 'Yusuf',
  'Shaban', 'Rajabu', 'Saidi', 'Hamad', 'Abeid', 'Kassim', 'Amani', 'Fadhili', 'Jafari', 'Daudi',
  'Ezekiel', 'Benjamin', 'Patrick', 'Francis', 'Stephen', 'Edward', 'Lawrence', 'Vincent', 'Martin', 'Paul'
];

const FIRST_NAMES_FEMALE = [
  'Fatuma', 'Mwanaisha', 'Amina', 'Zainab', 'Rehema', 'Happiness', 'Grace', 'Mary', 'Rose', 'Esther',
  'Joyce', 'Agnes', 'Dorothy', 'Margaret', 'Elizabeth', 'Catherine', 'Beatrice', 'Veronica', 'Juliana', 'Neema',
  'Salma', 'Halima', 'Khadija', 'Aisha', 'Mariam', 'Jamila', 'Saida', 'Rukia', 'Nasra', 'Hadija',
  'Tatu', 'Mwajuma', 'Asha', 'Mwanaid', 'Zawadi', 'Upendo', 'Farida', 'Zuhura', 'Mwanahamisi', 'Anna',
  'Gloria', 'Victoria', 'Caroline', 'Janet', 'Diana', 'Monica', 'Susan', 'Nancy', 'Josephine', 'Christina'
];

const MIDDLE_NAMES = [
  'Ally', 'Said', 'Mohamed', 'Hamisi', 'Juma', 'Hassan', 'Bakari', 'Salum', 'Omari', 'Rashid',
  'John', 'Peter', 'James', 'Paul', 'Joseph', 'David', 'Robert', 'William', 'Charles', 'Michael',
  'Mwita', 'Chacha', 'Marwa', 'Warioba', 'Nyerere', 'Mwinyi', 'Magufuli', 'Kikwete', 'Mkapa', 'Samia'
];

const LAST_NAMES = [
  'Mwakasege', 'Kimaro', 'Mshana', 'Massawe', 'Mushi', 'Urassa', 'Swai', 'Lyimo', 'Mlay', 'Shirima',
  'Mwakyusa', 'Mwambene', 'Komba', 'Mwangoka', 'Shayo', 'Temba', 'Mbise', 'Msuya', 'Minde', 'Mrema',
  'Makundi', 'Mbwambo', 'Msigwa', 'Mchome', 'Mwaseba', 'Mwakipunda', 'Mwakalobo', 'Mwakalinga', 'Mwakangale', 'Mwakibete',
  'Kapinga', 'Kingamkono', 'Kitila', 'Kileo', 'Kinabo', 'Kiondo', 'Kivenule', 'Kiwia', 'Kaaya', 'Kombe',
  'Lema', 'Lushoto', 'Lupogo', 'Lweno', 'Laiser', 'Lukindo', 'Lulela', 'Lwesha', 'Longwe', 'Lipangile',
  'Mwasote', 'Mwaijande', 'Mwaitege', 'Mwakanyamale', 'Mwakalebela', 'Mwakasungula', 'Mwakibinga', 'Mwakyembe', 'Mwampamba', 'Mwanyika',
  'Ndosi', 'Ngowi', 'Nkya', 'Nkini', 'Njau', 'Nkondokaya', 'Nyaki', 'Nyange', 'Nyakunga', 'Nyamweru',
  'Shoo', 'Sanga', 'Sumari', 'Simba', 'Sijaona', 'Sikalengo', 'Simbakalia', 'Silayo', 'Sanga', 'Swilla',
  'Temba', 'Tarimo', 'Tesha', 'Temu', 'Tibaijuka', 'Tungaraza', 'Tweve', 'Toure', 'Tindwa', 'Tupa',
  'Wambura', 'Warioba', 'William', 'Wililo', 'Wella', 'Wango', 'Wahome', 'Waziri', 'Wema', 'Wendo'
];

// Tanzanian regions for addresses
const REGIONS = [
  'Dar es Salaam', 'Arusha', 'Mwanza', 'Dodoma', 'Mbeya', 'Morogoro', 'Tanga', 'Kilimanjaro', 
  'Iringa', 'Kagera', 'Mara', 'Kigoma', 'Shinyanga', 'Tabora', 'Singida', 'Rukwa',
  'Pwani', 'Lindi', 'Mtwara', 'Ruvuma', 'Geita', 'Simiyu', 'Njombe', 'Katavi', 'Songwe'
];

const STREETS = [
  'Samora Avenue', 'Ali Hassan Mwinyi Road', 'Nyerere Road', 'Morogoro Road', 'Bagamoyo Road',
  'Uhuru Street', 'Bibi Titi Mohamed Street', 'Sokoine Drive', 'Mkwepu Street', 'Lumumba Street',
  'Kivukoni Front', 'Ocean Road', 'Upanga Road', 'Msasani Road', 'Haile Selassie Road'
];

// Utility functions
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomBoolean = () => Math.random() > 0.5;

// Generate random Tanzanian phone number
const generatePhone = () => {
  const prefixes = ['0754', '0755', '0756', '0757', '0758', '0713', '0714', '0715', '0716', '0717', 
                    '0782', '0783', '0784', '0785', '0786', '0762', '0763', '0764', '0765', '0766',
                    '0742', '0743', '0744', '0745', '0746'];
  return randomItem(prefixes) + randomInt(100000, 999999).toString();
};

// Generate random date of birth (age 18-70)
const generateDOB = () => {
  const currentYear = 2026;
  const age = randomInt(18, 70);
  const year = currentYear - age;
  const month = randomInt(1, 12);
  const day = randomInt(1, 28);
  return `${day.toString().padStart(2, '0')} ${['January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'][month - 1]} ${year}`;
};

// Generate random NIN (National ID Number)
const generateNIN = (dob) => {
  // Format: YYYYMMDDXXXXXXXXX (20 digits)
  const year = dob.split(' ')[2];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'];
  const month = (monthNames.indexOf(dob.split(' ')[1]) + 1).toString().padStart(2, '0');
  const day = dob.split(' ')[0].padStart(2, '0');
  const randomPart = randomInt(10000000000, 99999999999).toString();
  return `${year}${month}${day}${randomPart}`;
};

// Create axios instance
const api = axios.create({
  baseURL: MIFOS_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Fineract-Platform-TenantId': TENANT_ID
  },
  auth: {
    username: USERNAME,
    password: PASSWORD
  }
});

// Generate a random customer
const generateCustomer = (index) => {
  const isMale = randomBoolean();
  const firstName = isMale ? randomItem(FIRST_NAMES_MALE) : randomItem(FIRST_NAMES_FEMALE);
  const middleName = randomItem(MIDDLE_NAMES);
  const lastName = randomItem(LAST_NAMES);
  const dob = generateDOB();
  
  return {
    officeId: 1,
    firstname: firstName,
    middlename: middleName,
    lastname: lastName,
    externalId: `CUST${(index + 1).toString().padStart(5, '0')}`,
    dateFormat: 'dd MMMM yyyy',
    locale: 'en',
    active: true,
    activationDate: '01 January 2026',
    submittedOnDate: '01 January 2026',
    dateOfBirth: dob,
    genderId: isMale ? 15 : 16, // 15 = Male, 16 = Female
    mobileNo: generatePhone(),
    address: {
      addressLine1: `${randomInt(1, 500)} ${randomItem(STREETS)}`,
      city: randomItem(REGIONS),
      countryId: 1,
      stateProvinceId: 1
    },
    // Store NIN as external ID suffix
    _nin: generateNIN(dob),
    _region: randomItem(REGIONS)
  };
};

// Create client in MIFOS
const createClient = async (customer) => {
  try {
    const payload = {
      officeId: customer.officeId,
      legalFormId: 1, // 1 = Person, 2 = Entity
      firstname: customer.firstname,
      middlename: customer.middlename,
      lastname: customer.lastname,
      externalId: customer.externalId,
      dateFormat: customer.dateFormat,
      locale: customer.locale,
      active: customer.active,
      activationDate: customer.activationDate,
      submittedOnDate: customer.submittedOnDate,
      dateOfBirth: customer.dateOfBirth,
      mobileNo: customer.mobileNo,
      genderId: customer.genderId,
      clientTypeId: 17 // 17 = Retail
    };
    
    const response = await api.post('/clients', payload);
    return { success: true, clientId: response.data.clientId, resourceId: response.data.resourceId };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.errors?.[0]?.defaultUserMessage || error.message,
      customer: customer.firstname + ' ' + customer.lastname
    };
  }
};

// Create savings account for client
const createSavingsAccount = async (clientId, productId) => {
  try {
    const payload = {
      clientId: clientId,
      productId: productId,
      locale: 'en',
      dateFormat: 'dd MMMM yyyy',
      submittedOnDate: '01 January 2026'
    };
    
    const response = await api.post('/savingsaccounts', payload);
    return { success: true, savingsId: response.data.savingsId, resourceId: response.data.resourceId };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.errors?.[0]?.defaultUserMessage || error.message 
    };
  }
};

// Approve savings account
const approveSavingsAccount = async (savingsId) => {
  try {
    const payload = {
      locale: 'en',
      dateFormat: 'dd MMMM yyyy',
      approvedOnDate: '01 January 2026'
    };
    
    const response = await api.post(`/savingsaccounts/${savingsId}?command=approve`, payload);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.response?.data?.errors?.[0]?.defaultUserMessage || error.message };
  }
};

// Activate savings account
const activateSavingsAccount = async (savingsId) => {
  try {
    const payload = {
      locale: 'en',
      dateFormat: 'dd MMMM yyyy',
      activatedOnDate: '01 January 2026'
    };
    
    const response = await api.post(`/savingsaccounts/${savingsId}?command=activate`, payload);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.response?.data?.errors?.[0]?.defaultUserMessage || error.message };
  }
};

// Deposit money to savings account
const depositToSavings = async (savingsId, amount) => {
  try {
    const payload = {
      locale: 'en',
      dateFormat: 'dd MMMM yyyy',
      transactionDate: '01 January 2026',
      transactionAmount: amount,
      paymentTypeId: 1
    };
    
    const response = await api.post(`/savingsaccounts/${savingsId}/transactions?command=deposit`, payload);
    return { success: true, transactionId: response.data.resourceId };
  } catch (error) {
    return { success: false, error: error.response?.data?.errors?.[0]?.defaultUserMessage || error.message };
  }
};

// Main function
const main = async () => {
  console.log('🚀 Starting customer creation...\n');
  
  // Savings products to use (randomly assign)
  const savingsProducts = [1, 2, 4]; // RSA, PSA, JSA (excluding FDA which needs lock-in)
  
  const results = {
    clientsCreated: 0,
    savingsCreated: 0,
    depositsCompleted: 0,
    errors: []
  };
  
  const customers = [];
  
  // Generate 100 customers
  for (let i = 0; i < 100; i++) {
    customers.push(generateCustomer(i));
  }
  
  console.log(`📋 Generated ${customers.length} customer records\n`);
  
  // Process each customer
  for (let i = 0; i < customers.length; i++) {
    const customer = customers[i];
    const fullName = `${customer.firstname} ${customer.middlename} ${customer.lastname}`;
    
    process.stdout.write(`[${(i + 1).toString().padStart(3, '0')}/100] Creating ${fullName}...`);
    
    // Step 1: Create client
    const clientResult = await createClient(customer);
    
    if (!clientResult.success) {
      console.log(` ❌ Client failed: ${clientResult.error}`);
      results.errors.push({ step: 'client', customer: fullName, error: clientResult.error });
      continue;
    }
    
    results.clientsCreated++;
    const clientId = clientResult.clientId || clientResult.resourceId;
    
    // Step 2: Create savings account
    const productId = randomItem(savingsProducts);
    const savingsResult = await createSavingsAccount(clientId, productId);
    
    if (!savingsResult.success) {
      console.log(` ⚠️ Savings failed: ${savingsResult.error}`);
      results.errors.push({ step: 'savings', customer: fullName, error: savingsResult.error });
      continue;
    }
    
    results.savingsCreated++;
    const savingsId = savingsResult.savingsId || savingsResult.resourceId;
    
    // Step 3: Approve savings account
    const approveResult = await approveSavingsAccount(savingsId);
    if (!approveResult.success) {
      console.log(` ⚠️ Approve failed: ${approveResult.error}`);
      results.errors.push({ step: 'approve', customer: fullName, error: approveResult.error });
      continue;
    }
    
    // Step 4: Activate savings account
    const activateResult = await activateSavingsAccount(savingsId);
    if (!activateResult.success) {
      console.log(` ⚠️ Activate failed: ${activateResult.error}`);
      results.errors.push({ step: 'activate', customer: fullName, error: activateResult.error });
      continue;
    }
    
    // Step 5: Deposit random amount
    const depositAmount = randomInt(50000, 5000000); // TZS 50,000 to 5,000,000
    const depositResult = await depositToSavings(savingsId, depositAmount);
    
    if (!depositResult.success) {
      console.log(` ⚠️ Deposit failed: ${depositResult.error}`);
      results.errors.push({ step: 'deposit', customer: fullName, error: depositResult.error });
      continue;
    }
    
    results.depositsCompleted++;
    console.log(` ✅ ClientID: ${clientId}, SavingsID: ${savingsId}, Balance: TZS ${depositAmount.toLocaleString()}`);
    
    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Clients Created: ${results.clientsCreated}/100`);
  console.log(`✅ Savings Accounts Created: ${results.savingsCreated}/100`);
  console.log(`✅ Deposits Completed: ${results.depositsCompleted}/100`);
  console.log(`❌ Errors: ${results.errors.length}`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ Error Details:');
    results.errors.slice(0, 10).forEach((err, i) => {
      console.log(`  ${i + 1}. [${err.step}] ${err.customer}: ${err.error}`);
    });
    if (results.errors.length > 10) {
      console.log(`  ... and ${results.errors.length - 10} more errors`);
    }
  }
  
  console.log('\n✨ Done!');
};

main().catch(console.error);
