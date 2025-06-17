// Simple Node.js proxy server - TabScanner integration removed
// This helps avoid CORS issues in browser-based API calls

const http = require('http');
const https = require('https');
const url = require('url');
const querystring = require('querystring');
const fs = require('fs');

// Create server with more detailed error handling
const server = http.createServer((req, res) => {
  // Set CORS headers to allow requests from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, apikey');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // Log all incoming requests
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Parse the request URL
  const parsedUrl = url.parse(req.url, true);
  
  // Check if it's a proxy request - TabScanner proxy functionality removed
  if (parsedUrl.pathname.startsWith('/proxy')) {
    console.log('TabScanner proxy functionality has been removed');
    res.writeHead(501, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({
      error: 'TabScanner proxy functionality has been removed',
      message: 'Please use alternative OCR endpoints'
    }));
    return;
  }
  
  // Serve static files
  if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/index.html') {
    fs.readFile('./index.html', (err, data) => {
      if (err) {
        console.error('Error reading index.html:', err);
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.end('Not found');
        return;
      }
      
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.end(data);
    });
    return;
  }
  
  // Handle file requests
  fs.readFile('.' + parsedUrl.pathname, (err, data) => {
    if (err) {
      console.error('Error reading file:', parsedUrl.pathname, err);
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.end('Not found');
      return;
    }
    
    let contentType = 'text/plain';
    
    if (parsedUrl.pathname.endsWith('.html')) contentType = 'text/html';
    else if (parsedUrl.pathname.endsWith('.css')) contentType = 'text/css';
    else if (parsedUrl.pathname.endsWith('.js')) contentType = 'application/javascript';
    else if (parsedUrl.pathname.endsWith('.json')) contentType = 'application/json';
    else if (parsedUrl.pathname.endsWith('.png')) contentType = 'image/png';
    else if (parsedUrl.pathname.endsWith('.jpg') || parsedUrl.pathname.endsWith('.jpeg')) contentType = 'image/jpeg';
    
    res.writeHead(200, {'Content-Type': contentType});
    res.end(data);
  });
});

// Start the server on a different port (changed from 8888)
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log('To use the proxy, send requests to:');
  console.log(`- POST: http://localhost:${PORT}/proxy?endpoint=process`);
  console.log(`- GET:  http://localhost:${PORT}/proxy?endpoint=result/{token}`);
});

// Add error handler for server startup issues
server.on('error', (e) => {
  console.error('Server error:', e.message);
  if (e.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try another port.`);
  }
}); 