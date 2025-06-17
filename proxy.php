<?php
// TabScanner proxy script has been removed
// Use alternative OCR endpoints

http_response_code(501);
header('Content-Type: application/json');

echo json_encode([
    'error' => 'TabScanner proxy has been removed',
    'message' => 'Please use alternative OCR endpoints such as Gemini'
]); 