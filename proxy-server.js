// Simple Node.js proxy server for TabScanner API
// This helps avoid CORS issues in browser-based API calls

const http = require('http');
const https = require('https');
const url = require('url');
const querystring = require('querystring');
const fs = require('fs');
const formidable = require('formidable');

// TabScanner API configuration
const TABSCANNER_API_KEY = 'nUyYEmtzI1eoLtWRnqauWAC2W3n6p9V5GjuOmoKGBIeDgEpvLlnsWUUhVg0IfyA3';
const TABSCANNER_API_URL = 'https://api.tabscanner.com/2/';

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
  
  // Check if it's a proxy request
  if (parsedUrl.pathname.startsWith('/proxy')) {
    const endpoint = parsedUrl.query.endpoint;
    
    if (!endpoint) {
      console.error('No endpoint specified');
      res.writeHead(400, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({error: 'No endpoint specified'}));
      return;
    }
    
    const apiUrl = TABSCANNER_API_URL + endpoint;
    console.log(`Proxying request to: ${apiUrl}`);
    
    // Handle POST requests with file uploads
    if (req.method === 'POST') {
      console.log('Processing POST request for file upload');
      const form = new formidable.IncomingForm();
      
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error('Error parsing form data:', err);
          res.writeHead(500, {'Content-Type': 'application/json'});
          res.end(JSON.stringify({error: 'Error parsing form data', details: err.message}));
          return;
        }
        
        // Check if file exists
        if (!files.file) {
          console.error('No file provided in the request');
          res.writeHead(400, {'Content-Type': 'application/json'});
          res.end(JSON.stringify({error: 'No file provided'}));
          return;
        }
        
        console.log('File received:', files.file.originalFilename, 'Size:', files.file.size);
        
        // Create form data boundary
        const boundary = '---------------------------' + Date.now().toString(16);
        const headers = {
          'apikey': TABSCANNER_API_KEY,
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        };
        
        console.log('Preparing API request with headers:', Object.keys(headers));
        
        // Set up the request options
        const options = {
          method: 'POST',
          headers: headers
        };
        
        // Make the request to TabScanner API
        const apiReq = https.request(apiUrl, options, (apiRes) => {
          console.log('TabScanner API response status:', apiRes.statusCode);
          let data = '';
          
          apiRes.on('data', (chunk) => {
            data += chunk;
          });
          
          apiRes.on('end', () => {
            console.log('TabScanner API response data:', data.substring(0, 200) + '...');
            res.writeHead(apiRes.statusCode, {'Content-Type': 'application/json'});
            res.end(data);
          });
        });
        
        // Handle request errors
        apiReq.on('error', (error) => {
          console.error('Error making API request:', error);
          res.writeHead(500, {'Content-Type': 'application/json'});
          res.end(JSON.stringify({
            error: 'API request error',
            message: error.message
          }));
        });
        
        // Create multipart form data
        const boundaryStart = `--${boundary}\r\n`;
        const boundaryEnd = `\r\n--${boundary}--\r\n`;
        
        // Add fields
        for (const field in fields) {
          console.log('Adding field to request:', field);
          const part = boundaryStart +
                       `Content-Disposition: form-data; name="${field}"\r\n\r\n` +
                       `${fields[field]}\r\n`;
          apiReq.write(part);
        }
        
        // Add file
        if (files.file) {
          console.log('Adding file to request:', files.file.originalFilename);
          const file = files.file;
          const fileData = fs.readFileSync(file.filepath);
          
          const filePart = boundaryStart +
                          `Content-Disposition: form-data; name="file"; filename="${file.originalFilename}"\r\n` +
                          `Content-Type: ${file.mimetype}\r\n\r\n`;
          
          apiReq.write(filePart);
          apiReq.write(fileData);
          apiReq.write('\r\n');
        }
        
        // End the request
        apiReq.write(boundaryEnd);
        apiReq.end();
        console.log('API request sent');
      });
    } 
    // Handle GET requests
    else if (req.method === 'GET') {
      console.log('Processing GET request for endpoint:', endpoint);
      const options = {
        method: 'GET',
        headers: {
          'apikey': TABSCANNER_API_KEY
        }
      };
      
      // Make the request to TabScanner API
      const apiReq = https.request(apiUrl, options, (apiRes) => {
        console.log('TabScanner API GET response status:', apiRes.statusCode);
        let data = '';
        
        apiRes.on('data', (chunk) => {
          data += chunk;
        });
        
        apiRes.on('end', () => {
          console.log('TabScanner API GET response data:', data.substring(0, 200) + '...');
          res.writeHead(apiRes.statusCode, {'Content-Type': 'application/json'});
          res.end(data);
        });
      });
      
      // Handle request errors
      apiReq.on('error', (error) => {
        console.error('Error making API GET request:', error);
        res.writeHead(500, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({
          error: 'API request error',
          message: error.message
        }));
      });
      
      apiReq.end();
    }
    // Handle other HTTP methods
    else {
      console.error('Method not allowed:', req.method);
      res.writeHead(405, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({error: 'Method not allowed'}));
    }
    
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