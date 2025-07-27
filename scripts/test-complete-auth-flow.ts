import fetch from 'node-fetch';

const BASE_URL = process.env.NEXTAUTH_URL || 'https://taxreturnpro.com.au';

interface TestResult {
  step: string;
  success: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function addResult(step: string, success: boolean, message: string, details?: any) {
  results.push({ step, success, message, details });
  console.log(`${success ? '✅' : '❌'} ${step}: ${message}`);
  if (details) {
    console.log('   Details:', JSON.stringify(details, null, 2));
  }
}

async function testAuthFlow() {
  console.log('🧪 Testing Complete Authentication Flow');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log('=====================================\n');

  const timestamp = Date.now();
  const testEmail = `test${timestamp}@example.com`;
  const testPassword = 'TestPassword123!';
  const testName = `Test User ${timestamp}`;

  try {
    // 1. Test Registration
    console.log('1️⃣ Testing Registration...');
    const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: testName,
      }),
    });

    const registerData = await registerRes.json();

    if (registerRes.ok) {
      addResult('Registration', true, 'User registered successfully', registerData);
    } else {
      addResult(
        'Registration',
        false,
        `Failed: ${registerData.message || registerData.error}`,
        registerData,
      );
      return;
    }

    console.log('');

    // 2. Test Login
    console.log('2️⃣ Testing Login...');
    const loginRes = await fetch(`${BASE_URL}/api/auth/simple-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    const loginData = await loginRes.json();

    if (loginRes.ok) {
      addResult('Login', true, 'Login successful', loginData);
    } else {
      addResult('Login', false, `Failed: ${loginData.message}`, loginData);
    }

    console.log('');

    // 3. Test Login with Wrong Password
    console.log('3️⃣ Testing Login with Wrong Password...');
    const wrongLoginRes = await fetch(`${BASE_URL}/api/auth/simple-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword123!',
      }),
    });

    const wrongLoginData = await wrongLoginRes.json();

    if (!wrongLoginRes.ok && wrongLoginRes.status === 401) {
      addResult('Wrong Password', true, 'Correctly rejected invalid password', wrongLoginData);
    } else {
      addResult(
        'Wrong Password',
        false,
        'Security issue: accepted wrong password!',
        wrongLoginData,
      );
    }

    console.log('');

    // 4. Test Forgot Password
    console.log('4️⃣ Testing Forgot Password...');
    const forgotRes = await fetch(`${BASE_URL}/api/auth/simple-forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
      }),
    });

    const forgotData = await forgotRes.json();

    if (forgotRes.ok) {
      addResult('Forgot Password', true, 'Reset token generated', forgotData);

      // In production, token would be in email. For testing, it might be in debug response
      const resetToken = forgotData.debug?.resetToken;

      if (resetToken) {
        console.log('');

        // 5. Test Password Reset
        console.log('5️⃣ Testing Password Reset...');
        const newPassword = 'NewTestPassword123!';

        const resetRes = await fetch(`${BASE_URL}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: resetToken,
            password: newPassword,
          }),
        });

        const resetData = await resetRes.json();

        if (resetRes.ok) {
          addResult('Password Reset', true, 'Password reset successful', resetData);

          console.log('');

          // 6. Test Login with New Password
          console.log('6️⃣ Testing Login with New Password...');
          const newLoginRes = await fetch(`${BASE_URL}/api/auth/simple-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: testEmail,
              password: newPassword,
            }),
          });

          const newLoginData = await newLoginRes.json();

          if (newLoginRes.ok) {
            addResult(
              'Login with New Password',
              true,
              'Login successful with new password',
              newLoginData,
            );
          } else {
            addResult(
              'Login with New Password',
              false,
              `Failed: ${newLoginData.message}`,
              newLoginData,
            );
          }
        } else {
          addResult(
            'Password Reset',
            false,
            `Failed: ${resetData.message || resetData.error}`,
            resetData,
          );
        }
      } else {
        addResult('Password Reset', false, 'No reset token available for testing', null);
      }
    } else {
      addResult('Forgot Password', false, `Failed: ${forgotData.message}`, forgotData);
    }

    // 7. Test with existing test user
    console.log('\n7️⃣ Testing with Existing Test User...');
    const existingLoginRes = await fetch(`${BASE_URL}/api/auth/simple-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'testuser@example.com',
        password: 'TestPassword123!',
      }),
    });

    const existingLoginData = await existingLoginRes.json();

    if (existingLoginRes.ok) {
      addResult('Existing User Login', true, 'Login successful', existingLoginData);
    } else {
      addResult(
        'Existing User Login',
        false,
        `Failed: ${existingLoginData.message}`,
        existingLoginData,
      );
    }
  } catch (error: any) {
    console.error('\n❌ Test Error:', error.message);
    addResult('Test Execution', false, error.message, error);
  }

  // Summary
  console.log('\n=====================================');
  console.log('📊 Test Summary:');
  console.log('=====================================');

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / results.length) * 100)}%`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`   - ${r.step}: ${r.message}`);
      });
  }

  console.log('\n✨ Test Complete!\n');
}

// Run the test
testAuthFlow();
