// Code validation module using isolated-vm for secure sandboxed execution
const ivm = require('isolated-vm');

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
 * Run code in isolated sandbox and execute test cases
 */
async function runTestCases(code, functionName, testCases) {
  const results = [];
  
  // Create a new isolate with memory limit
  const isolate = new ivm.Isolate({ memoryLimit: 32 }); // 32MB limit
  
  try {
    for (const testCase of testCases) {
      const context = await isolate.createContext();
      const jail = context.global;
      
      // Set up minimal global environment
      await jail.set('global', jail.derefInto());
      
      try {
        // Compile and run the function definition
        const script = await isolate.compileScript(code);
        await script.run(context, { timeout: 1000 });
        
        // Prepare test input as JSON
        const inputJson = JSON.stringify(testCase.input);
        
        // Call the function with test input
        const callScript = await isolate.compileScript(`
          (function() {
            const args = ${inputJson};
            const result = ${functionName}.apply(null, args);
            return JSON.stringify(result);
          })()
        `);
        
        const resultJson = await callScript.run(context, { timeout: 1000 });
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
      
      context.release();
    }
  } finally {
    isolate.dispose();
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

  const isolate = new ivm.Isolate({ memoryLimit: 32 });
  const context = await isolate.createContext();
  const jail = context.global;
  await jail.set('global', jail.derefInto());

  const results = [];
  let allPassed = true;

  try {
    // 1. Compile user code
    const script = await isolate.compileScript(code);
    await script.run(context, { timeout: 1000 });

    // 2. Instantiate calculator
    // Check if class exists first
    const checkClassScript = await isolate.compileScript('typeof ScientificCalculator !== "undefined"');
    const exists = await checkClassScript.run(context);
    
    if (!exists) {
      throw new Error('ScientificCalculator class not defined');
    }

    await isolate.compileScript('const calc = new ScientificCalculator();').then(s => s.run(context));

    // 3. Run test cases
    for (const test of testCases) {
      const { method, args, expected } = test;
      const argsJson = JSON.stringify(args);
      
      try {
        const testScript = await isolate.compileScript(`
          (function() {
            try {
              if (typeof calc['${method}'] !== 'function') {
                 return JSON.stringify({ error: 'Method not found' });
              }
              const res = calc['${method}'](...${argsJson});
              return JSON.stringify({ result: res });
            } catch (e) {
              return JSON.stringify({ error: e.message });
            }
          })()
        `);
        
        const resultJson = await testScript.run(context, { timeout: 500 });
        const result = JSON.parse(resultJson);
        
        let passed = false;
        let actual = null;
        let error = null;

        if (result.error) {
          if (expected === 'Error') {
             passed = true; // Expected an error and got one
             actual = 'Error';
          } else {
             passed = false;
             error = result.error;
          }
        } else {
          actual = result.result;
          // Simple equality check for primitives
          // For 'Error' expectation, we failed because we got a result
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
  } finally {
    isolate.dispose();
  }
}

module.exports = {
  validateCode,
  validateCalculatorCode,
  checkSafety,
  extractFunctionName
};
