// Create test loan data for Grafana visualization
const mongoose = require('mongoose');
const LoanMapping = require('./src/models/LoanMapping');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/miracore';

async function createTestLoans() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Sample test loans across different statuses
    const testLoans = [
      {
        essApplicationNumber: 'ESS1766100000001',
        essLoanNumberAlias: 'LN2025001',
        essCheckNumber: 'CHK2025001',
        status: 'INITIAL_OFFER',
        productCode: 'PERSONAL_LOAN',
        requestedAmount: 500000,
        loanAmount: 500000,
        tenure: 12,
        loanPurpose: 'Business Development',
        employerName: 'ABC Corporation',
        employeeNIN: 'CM12345678901234',
        employeeName: 'John Doe',
        employeeMobile: '237670000001',
        createdAt: new Date('2025-12-20'),
        updatedAt: new Date('2025-12-20')
      },
      {
        essApplicationNumber: 'ESS1766100000002',
        essLoanNumberAlias: 'LN2025002',
        essCheckNumber: 'CHK2025002',
        status: 'OFFER_SUBMITTED',
        productCode: 'EDUCATION_LOAN',
        requestedAmount: 750000,
        loanAmount: 750000,
        tenure: 24,
        loanPurpose: 'Education',
        employerName: 'XYZ Industries',
        employeeNIN: 'CM12345678901235',
        employeeName: 'Jane Smith',
        employeeMobile: '237670000002',
        createdAt: new Date('2025-12-21'),
        updatedAt: new Date('2025-12-21')
      },
      {
        essApplicationNumber: 'ESS1766100000003',
        essLoanNumberAlias: 'LN2025003',
        essCheckNumber: 'CHK2025003',
        status: 'APPROVED',
        productCode: 'HOME_IMPROVEMENT',
        requestedAmount: 1000000,
        loanAmount: 1000000,
        tenure: 36,
        loanPurpose: 'Home Improvement',
        employerName: 'Tech Solutions Ltd',
        employeeNIN: 'CM12345678901236',
        employeeName: 'Mike Johnson',
        employeeMobile: '237670000003',
        mifosClientId: '101',
        createdAt: new Date('2025-12-19'),
        updatedAt: new Date('2025-12-22')
      },
      {
        essApplicationNumber: 'ESS1766100000004',
        essLoanNumberAlias: 'LN2025004',
        essCheckNumber: 'CHK2025004',
        status: 'DISBURSED',
        productCode: 'EMERGENCY_LOAN',
        requestedAmount: 2000000,
        loanAmount: 2000000,
        tenure: 18,
        loanPurpose: 'Emergency Medical',
        employerName: 'Global Bank',
        employeeNIN: 'CM12345678901237',
        employeeName: 'Sarah Williams',
        employeeMobile: '237670000004',
        mifosClientId: '102',
        mifosLoanId: '201',
        disbursementDate: new Date('2025-12-22'),
        createdAt: new Date('2025-12-18'),
        updatedAt: new Date('2025-12-22')
      },
      {
        essApplicationNumber: 'ESS1766100000005',
        essLoanNumberAlias: 'LN2025005',
        essCheckNumber: 'CHK2025005',
        status: 'REJECTED',
        productCode: 'PERSONAL_LOAN',
        requestedAmount: 300000,
        loanAmount: 300000,
        tenure: 12,
        loanPurpose: 'Personal Loan',
        employerName: 'Manufacturing Co',
        employeeNIN: 'CM12345678901238',
        employeeName: 'David Brown',
        employeeMobile: '237670000005',
        rejectedBy: 'EMPLOYER',
        rejectionReason: 'Insufficient employment tenure',
        createdAt: new Date('2025-12-17'),
        updatedAt: new Date('2025-12-18')
      },
      {
        essApplicationNumber: 'ESS1766100000006',
        essLoanNumberAlias: 'LN2025006',
        essCheckNumber: 'CHK2025006',
        status: 'CANCELLED',
        productCode: 'DEBT_CONSOLIDATION',
        requestedAmount: 450000,
        loanAmount: 450000,
        tenure: 24,
        loanPurpose: 'Debt Consolidation',
        employerName: 'Retail Group',
        employeeNIN: 'CM12345678901239',
        employeeName: 'Emily Davis',
        employeeMobile: '237670000006',
        cancelledBy: 'EMPLOYEE',
        cancellationReason: 'Customer requested cancellation',
        createdAt: new Date('2025-12-16'),
        updatedAt: new Date('2025-12-17')
      },
      {
        essApplicationNumber: 'ESS1766100000007',
        essLoanNumberAlias: 'LN2025007',
        essCheckNumber: 'CHK2025007',
        status: 'DISBURSED',
        productCode: 'VEHICLE_LOAN',
        requestedAmount: 1500000,
        loanAmount: 1500000,
        tenure: 48,
        loanPurpose: 'Vehicle Purchase',
        employerName: 'Construction Ltd',
        employeeNIN: 'CM12345678901240',
        employeeName: 'Robert Taylor',
        employeeMobile: '237670000007',
        mifosClientId: '103',
        mifosLoanId: '202',
        disbursementDate: new Date('2025-12-21'),
        createdAt: new Date('2025-12-15'),
        updatedAt: new Date('2025-12-21')
      },
      {
        essApplicationNumber: 'ESS1766100000008',
        essLoanNumberAlias: 'LN2025008',
        essCheckNumber: 'CHK2025008',
        status: 'INITIAL_OFFER',
        productCode: 'WEDDING_LOAN',
        requestedAmount: 600000,
        loanAmount: 600000,
        tenure: 18,
        loanPurpose: 'Wedding Expenses',
        employerName: 'Healthcare Services',
        employeeNIN: 'CM12345678901241',
        employeeName: 'Lisa Anderson',
        employeeMobile: '237670000008',
        createdAt: new Date('2025-12-22'),
        updatedAt: new Date('2025-12-22')
      }
    ];

    // Insert test loans
    const result = await LoanMapping.insertMany(testLoans);
    console.log(`✅ Created ${result.length} test loan records`);

    // Show count by status
    const stats = await LoanMapping.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    console.log('\n📊 Loan Status Breakdown:');
    stats.forEach(s => console.log(`   ${s._id}: ${s.count}`));

    console.log('\n✅ Test data created successfully!');
    console.log('🔄 Grafana will show this data within 60 seconds (next metrics update)');
    console.log('📊 Or refresh your Grafana dashboard now to see the data immediately');
    
  } catch (error) {
    console.error('❌ Error creating test loans:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

createTestLoans();
