<?php
// Simple proxy script for TabScanner API
// This helps avoid CORS issues in browser-based API calls

// TabScanner API configuration
$api_key = 'nUyYEmtzI1eoLtWRnqauWAC2W3n6p9V5GjuOmoKGBIeDgEpvLlnsWUUhVg0IfyA3';
$api_base_url = 'https://api.tabscanner.com/api/2/';

// Get the endpoint from the query string
$endpoint = isset($_GET['endpoint']) ? $_GET['endpoint'] : '';
if (empty($endpoint)) {
    http_response_code(400);
    echo json_encode(['error' => 'No endpoint specified']);
    exit;
}

// Build the full URL
$url = $api_base_url . $endpoint;

// Initialize cURL session
$ch = curl_init($url);

// Set up the request based on the HTTP method
$method = $_SERVER['REQUEST_METHOD'];
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

// Set headers
$headers = [
    'apikey: ' . $api_key,
];
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

// Handle file uploads for POST requests
if ($method === 'POST' && !empty($_FILES)) {
    $post_data = [];
    
    // Add other POST fields if any
    if (!empty($_POST)) {
        foreach ($_POST as $key => $value) {
            $post_data[$key] = $value;
        }
    }
    
    // Add files
    foreach ($_FILES as $key => $file_info) {
        if ($file_info['error'] === UPLOAD_ERR_OK) {
            $post_data[$key] = new CURLFile(
                $file_info['tmp_name'],
                $file_info['type'],
                $file_info['name']
            );
        }
    }
    
    curl_setopt($ch, CURLOPT_POSTFIELDS, $post_data);
}

// Execute the request
$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);

// Check for cURL errors
if ($response === false) {
    http_response_code(500);
    echo json_encode([
        'error' => 'cURL error',
        'message' => curl_error($ch)
    ]);
    curl_close($ch);
    exit;
}

// Close cURL session
curl_close($ch);

// Forward the response status code
http_response_code($http_code);

// Set the content type header
header('Content-Type: application/json');

// Output the response
echo $response; 