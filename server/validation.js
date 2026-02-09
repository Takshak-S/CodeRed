// Code validation module using Node.js vm for sandboxed execution
const vm = require('vm');

// Dangerous patterns to block
const DANGEROUS_PATTERNS = [
  /\brequire\s*\(/,
  /\bimport\s+/,
  /\bprocess\b/,
  /\bglobal\b/,
  /\beval\s*\(/,
  /\bFunction\s*\(/,
  /\b__dirname\b/,
  /\b__filename\b/,
  /\bsetTimeout\b/,
  /\bsetInterval\b/,
  /\bsetImmediate\b/,
  /\bfetch\b/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
];

// Function name patterns to extract
const FUNCTION_PATTERNS = [
  /function\s+(\w+)\s*\(/,
  /const\s+(\w+)\s*=\s*(?:function|\()/,
  /let\s+(\w+)\s*=\s*(?:function|\()/,
  /var\s+(\w+)\s*=\s*(?:function|\()/,
];

/**
 * Check if code contains a valid function definition
 */
function extractFunctionName(code) {
  for (const pattern of FUNCTION_PATTERNS) {
    const match = code.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

/**
 * Check code for dangerous patterns
 */
function checkSafety(code) {
  const issues = [];
  
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      issues.push(`Dangerous pattern detected: ${pattern.source}`);
    }
  }
  
  return {
    safe: issues.length === 0,
    issues
  };
}

/**
 * Run code in sandbox and execute test cases
 */
async function runTestCases(code, functionName, testCases) {
  const results = [];

  for (const testCase of testCases) {
    try {
      const sandbox = { Math, Error, JSON, console: { log: () => {} } };
      const context = vm.createContext(sandbox);

      // Run the function definition
      vm.runInContext(code, context, { timeout: 2000 });

      // Call the function with test input
      const inputJson = JSON.stringify(testCase.input);
      const callCode = `
        (function() {
          var args = ${inputJson};
          var result = ${functionName}.apply(null, args);
          return JSON.stringify(result);
        })()
      `;

      const resultJson = vm.runInContext(callCode, context, { timeout: 1000 });
      const actual = JSON.parse(resultJson);

      const passed = JSON.stringify(actual) === JSON.stringify(testCase.expected);

      results.push({
        input: testCase.input,
        expected: testCase.expected,
        actual,
        passed,
        error: null
      });
    } catch (error) {
      results.push({
        input: testCase.input,
        expected: testCase.expected,
        actual: null,
        passed: false,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Main validation function
 */
async function validateCode(code, testCases) {
  // Step 1: Check if code has a function
  const functionName = extractFunctionName(code);
  if (!functionName) {
    return {
      success: false,
      error: 'No valid function definition found',
      safetyCheck: { safe: false, issues: ['No function detected'] },
      results: []
    };
  }
  
  // Step 2: Safety checks
  const safetyCheck = checkSafety(code);
  if (!safetyCheck.safe) {
    return {
      success: false,
      error: 'Code failed safety checks',
      safetyCheck,
      results: []
    };
  }
  
  // Step 3: Run test cases
  try {
    const results = await runTestCases(code, functionName, testCases);
    const allPassed = results.every(r => r.passed);
    
    return {
      success: true,
      error: null,
      safetyCheck,
      functionName,
      results,
      allPassed,
      passedCount: results.filter(r => r.passed).length,
      totalCount: results.length
    };
  } catch (error) {
    return {
      success: false,
      error: `Execution error: ${error.message}`,
      safetyCheck,
      results: []
    };
  }
}

/**
 * Optimize class-based validation for Scientific Calculator
 */
async function validateCalculatorCode(code, testCases) {
  // Use existing safety check
  const safetyCheck = checkSafety(code);
  
  if (!safetyCheck.safe) {
    return {
      success: false,
      error: 'Code failed safety checks',
      safetyCheck,
      results: []
    };
  }

  const results = [];
  let allPassed = true;

  try {
    // Create a sandbox with necessary globals
    const sandbox = { Math, Error, JSON, console: { log: () => {} } };
    const context = vm.createContext(sandbox);

    // 1. Run user code (class definition)
    vm.runInContext(code, context, { timeout: 2000 });

    // 2. Check if class exists
    const exists = vm.runInContext('typeof ScientificCalculator !== "undefined"', context, { timeout: 500 });
    if (!exists) {
      throw new Error('ScientificCalculator class not defined');
    }

    // 3. Run test cases — each gets a fresh instance
    for (const test of testCases) {
      const { method, args, expected } = test;
      const argsJson = JSON.stringify(args);

      try {
        // Create fresh instance + run test in one go
        const testCode = `
          (function() {
            try {
              var testCalc = new ScientificCalculator();
              if (typeof testCalc['${method}'] !== 'function') {
                return JSON.stringify({ error: 'Method not found' });
              }
              var res = testCalc['${method}'].apply(testCalc, ${argsJson});
              return JSON.stringify({ result: res });
            } catch (e) {
              return JSON.stringify({ error: e.message });
            }
          })()
        `;

        const resultJson = vm.runInContext(testCode, context, { timeout: 1000 });
        const result = JSON.parse(resultJson);

        let passed = false;
        let actual = null;
        let error = null;

        if (result.error) {
          if (expected === 'Error') {
            passed = true;
            actual = 'Error';
          } else {
            passed = false;
            error = result.error;
          }
        } else {
          actual = result.result;
          if (expected === 'Error') {
            passed = false;
            error = `Expected Error but got ${actual}`;
          } else {
            passed = JSON.stringify(actual) === JSON.stringify(expected);
          }
        }

        if (!passed) allPassed = false;

        results.push({
          method,
          input: args,
          expected,
          actual,
          passed,
          error
        });

      } catch (err) {
        allPassed = false;
        results.push({
          method,
          input: args,
          expected,
          passed: false,
          error: `Execution Logic Error: ${err.message}`
        });
      }
    }

    return {
      success: true,
      allPassed,
      results,
      safetyCheck
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      safetyCheck,
      results: []
    };
  }
}

module.exports = {
  validateCode,
  validateCalculatorCode,
  checkSafety,
  extractFunctionName
};
