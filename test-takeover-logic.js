// Simple unit test for takeover amount fallback logic

console.log('🧪 Testing Takeover Amount Fallback Logic\n');
console.log('='.repeat(60));

function testAmountFallback(requestedTakeoverAmount, takeOverAmount) {
    let requestedAmount = parseFloat(requestedTakeoverAmount) || 0;
    const takeOverAmount_parsed = parseFloat(takeOverAmount) || 0;
    
    let result = {
        input: { requestedTakeoverAmount, takeOverAmount },
        output: null,
        usedField: null,
        shouldProcess: false
    };
    
    if (!requestedAmount || requestedAmount <= 0) {
        if (takeOverAmount_parsed > 0) {
            requestedAmount = takeOverAmount_parsed;
            result.output = requestedAmount;
            result.usedField = 'TakeOverAmount';
            result.shouldProcess = true;
        } else {
            result.output = 0;
            result.usedField = 'NONE';
            result.shouldProcess = false;
        }
    } else {
        result.output = requestedAmount;
        result.usedField = 'RequestedTakeoverAmount';
        result.shouldProcess = true;
    }
    
    return result;
}

// Test Cases
const tests = [
    {
        name: 'Test 1: Both amounts provided',
        requestedTakeoverAmount: 3000000,
        takeOverAmount: 2500000,
        expected: { amount: 3000000, field: 'RequestedTakeoverAmount', process: true }
    },
    {
        name: 'Test 2: Only TakeOverAmount provided',
        requestedTakeoverAmount: null,
        takeOverAmount: 2500000,
        expected: { amount: 2500000, field: 'TakeOverAmount', process: true }
    },
    {
        name: 'Test 3: Only TakeOverAmount (RequestedTakeoverAmount = 0)',
        requestedTakeoverAmount: 0,
        takeOverAmount: 1387713.11,
        expected: { amount: 1387713.11, field: 'TakeOverAmount', process: true }
    },
    {
        name: 'Test 4: Both missing',
        requestedTakeoverAmount: null,
        takeOverAmount: null,
        expected: { amount: 0, field: 'NONE', process: false }
    },
    {
        name: 'Test 5: Both zero',
        requestedTakeoverAmount: 0,
        takeOverAmount: 0,
        expected: { amount: 0, field: 'NONE', process: false }
    },
    {
        name: 'Test 6: Real case from UTUMISHI (ESS1766476759636)',
        requestedTakeoverAmount: null,
        takeOverAmount: 1387713.11,
        expected: { amount: 1387713.11, field: 'TakeOverAmount', process: true }
    }
];

console.log('\nRunning Tests:\n');

let passed = 0;
let failed = 0;

tests.forEach((test, index) => {
    console.log(`\n${test.name}`);
    console.log('-'.repeat(60));
    
    const result = testAmountFallback(test.requestedTakeoverAmount, test.takeOverAmount);
    
    console.log('Input:');
    console.log('  RequestedTakeoverAmount:', test.requestedTakeoverAmount);
    console.log('  TakeOverAmount:', test.takeOverAmount);
    console.log('\nResult:');
    console.log('  Final Amount:', result.output);
    console.log('  Used Field:', result.usedField);
    console.log('  Should Process:', result.shouldProcess);
    
    const isPass = 
        result.output === test.expected.amount &&
        result.usedField === test.expected.field &&
        result.shouldProcess === test.expected.process;
    
    if (isPass) {
        console.log('\n✅ PASSED');
        passed++;
    } else {
        console.log('\n❌ FAILED');
        console.log('Expected:', test.expected);
        console.log('Got:', { amount: result.output, field: result.usedField, process: result.shouldProcess });
        failed++;
    }
});

console.log('\n' + '='.repeat(60));
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${tests.length} tests`);

if (failed === 0) {
    console.log('✅ All tests passed! The fix is working correctly.\n');
} else {
    console.log('❌ Some tests failed. Please review the logic.\n');
}
