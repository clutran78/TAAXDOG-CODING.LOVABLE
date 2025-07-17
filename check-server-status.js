const http = require('http');

function checkServer() {
  console.log('🔍 Checking server status...\n');
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/',
    method: 'GET',
    timeout: 5000
  };

  const req = http.request(options, (res) => {
    console.log(`✅ Server is running!`);
    console.log(`   Status Code: ${res.statusCode}`);
    console.log(`   Server: ${res.headers.server || 'Next.js'}`);
    console.log(`\n💡 The server is up and accepting connections.`);
    console.log(`   You can access it at: http://localhost:3000`);
  });

  req.on('error', (error) => {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Server is not running!');
      console.log('\n📝 To start the server, run:');
      console.log('   npm run dev');
      console.log('\n   Or for production mode:');
      console.log('   npm run build && npm start');
    } else {
      console.log(`❌ Error checking server: ${error.message}`);
    }
  });

  req.on('timeout', () => {
    console.log('⏱️  Server check timed out');
    console.log('   The server might be starting up or experiencing issues.');
    req.destroy();
  });

  req.end();
}

// Check server status
checkServer();