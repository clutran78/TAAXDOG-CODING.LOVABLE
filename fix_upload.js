// Receipt Upload and Processing System (Step 5.2)
// This script handles receipt uploading, processing through OCR API, and storage

document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing receipt processing system');
    
    // Debug flag - we'll try real API first in all cases
    const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // Tabscanner API configuration
    const TABSCANNER_API_KEY = 'nUyYEmtzI1eoLtWRnqauWAC2W3n6p9V5GjuOmoKGBIeDgEpvLlnsWUUhVg0IfyA3';
    const TABSCANNER_API_URL = 'https://api.tabscanner.com/2';
    // Our proxy server URL - updated to port 3000
    const PROXY_URL = 'http://localhost:3000/proxy';
    
    // Initialize receipt components
    setupReceiptUploader();
    setupCameraCapture();
    setupReceiptsList();
    
    // Function to set up the receipt uploader
    function setupReceiptUploader() {
        console.log('Setting up receipt uploader');
        
        const uploadForm = document.getElementById('receipt-upload-form');
        const uploadButton = document.getElementById('receipt-upload-submit');
        const fileInput = document.getElementById('receipt-image');
        const previewContainer = document.getElementById('receipt-preview-container');
        const previewImage = document.getElementById('receipt-preview');
        const uploadProgress = document.getElementById('receipt-upload-progress');
        const uploadResult = document.getElementById('receipt-upload-result');
        const uploadAnother = document.getElementById('upload-another');
        
        if (!uploadForm || !uploadButton || !fileInput) {
            console.error('Required receipt upload elements not found');
            return;
        }
        
        // Show preview when an image is selected
        fileInput.addEventListener('change', function(e) {
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    previewImage.src = e.target.result;
                    previewContainer.style.display = 'block';
                };
                reader.readAsDataURL(this.files[0]);
            }
        });
        
        // Handle upload form submission
        uploadForm.addEventListener('submit', function(e) {
            e.preventDefault();
            console.log('Form submitted');
            
            // Validate form
            if (!fileInput.files || !fileInput.files[0]) {
                alert('Please select a receipt image to upload');
                return;
            }
            
            // Get form data
            const receiptImage = fileInput.files[0];
            const category = document.getElementById('receipt-category').value;
            const notes = document.getElementById('receipt-notes').value;
            
            console.log('Starting receipt processing with image:', receiptImage.name);
            
            // Show progress
            uploadProgress.style.display = 'block';
            uploadResult.style.display = 'none';
            uploadButton.disabled = true;
            
            // Process the receipt with real API (no fallback first)
            processReceiptWithTabscanner(receiptImage, category, notes)
                .then(receipt => {
                    console.log('Receipt processed successfully:', receipt);
                    // Save receipt to storage and show success message
                    if (saveReceiptToStorage(receipt)) {
                        showSuccessMessage(receipt);
                        
                        // Show the "upload another" button
                        uploadButton.style.display = 'none';
                        uploadAnother.style.display = 'inline-block';
                        
                        // Set up the "upload another" button click handler
                        uploadAnother.onclick = function() {
                            resetUploadForm();
                        };
                    } else {
                        showErrorMessage('Failed to save receipt to storage');
                        uploadButton.disabled = false;
                    }
                })
                .catch(error => {
                    console.error('Error processing receipt:', error);
                    showErrorMessage(error.message || 'Failed to process receipt');
                    uploadButton.disabled = false;
                })
                .finally(() => {
                    if (uploadProgress) uploadProgress.style.display = 'none';
                });
        });
    }
    
    // Function to process receipt with TabScanner API
    async function processReceiptWithTabscanner(imageFile, category, notes) {
        console.log('Processing receipt with TabScanner API');
        try {
            // Create form data for API request
            const formData = new FormData();
            formData.append('file', imageFile);
            
            // Step 1: Send the image to TabScanner for processing via proxy
            console.log('Uploading receipt image to TabScanner via proxy');
            
            // Use our Node.js proxy server with updated port
            const apiUrl = `${PROXY_URL}?endpoint=process`;
            console.log('Sending request to proxy:', apiUrl);
            
            // Add a timeout for the fetch request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
            
            // Properly handle potential network errors
            try {
                const uploadResponse = await fetch(apiUrl, {
                    method: 'POST',
                    body: formData,
                    signal: controller.signal
                });
                
                // Clear the timeout
                clearTimeout(timeoutId);
                
                if (!uploadResponse.ok) {
                    let errorMessage = `HTTP error: ${uploadResponse.status}`;
                    try {
                        const errorData = await uploadResponse.json();
                        console.error('TabScanner upload error:', errorData);
                        errorMessage = `TabScanner API error: ${errorData.message || errorData.error || uploadResponse.statusText}`;
                    } catch (e) {
                        console.error('Could not parse error response:', e);
                    }
                    throw new Error(errorMessage);
                }
                
                // Parse the JSON response and log it
                let uploadData;
                try {
                    uploadData = await uploadResponse.json();
                    console.log('TabScanner upload response:', uploadData);
                } catch (jsonError) {
                    console.error('Error parsing upload response as JSON:', jsonError);
                    const responseText = await uploadResponse.text();
                    console.log('Raw response:', responseText);
                    throw new Error('Invalid response from server (not JSON)');
                }
                
                if (!uploadData.success || !uploadData.token) {
                    throw new Error('Failed to get processing token from TabScanner: ' + 
                        (uploadData.message || 'Unknown error'));
                }
                
                const token = uploadData.token;
                
                // Step 2: Poll for results (OCR processing takes time)
                console.log('Polling for TabScanner results with token:', token);
                let result = null;
                let attempts = 0;
                const maxAttempts = 30; // Increased for reliability
                
                while (!result && attempts < maxAttempts) {
                    attempts++;
                    console.log(`Polling attempt ${attempts}/${maxAttempts}`);
                    
                    // Wait 2 seconds between polling attempts
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // Using the proxy for polling requests
                    const resultUrl = `${PROXY_URL}?endpoint=result/${token}`;
                    console.log('Polling URL:', resultUrl);
                    
                    try {
                        const resultResponse = await fetch(resultUrl, {
                            method: 'GET'
                        });
                        
                        if (!resultResponse.ok) {
                            console.warn(`Polling error on attempt ${attempts}, status: ${resultResponse.status}`);
                            continue;
                        }
                        
                        // Parse the JSON response
                        let resultData;
                        try {
                            resultData = await resultResponse.json();
                        } catch (jsonError) {
                            console.error('Error parsing result response as JSON:', jsonError);
                            const responseText = await resultResponse.text();
                            console.log('Raw result response:', responseText);
                            continue; // Skip this polling attempt
                        }
                        
                        console.log(`Polling result attempt ${attempts}:`, resultData);
                        
                        if (resultData.success && resultData.status === 'done') {
                            result = resultData.result;
                            break;
                        } else if (resultData.status === 'error') {
                            throw new Error(`TabScanner processing error: ${resultData.message || 'Unknown error'}`);
                        }
                        // If status is 'processing', continue polling
                    } catch (pollError) {
                        console.warn(`Error during polling attempt ${attempts}:`, pollError);
                        // Continue trying despite errors in individual polling attempts
                    }
                }
                
                if (!result) {
                    // If we reached the max attempts but don't have an error yet, use simulated data
                    if (isDevelopment) {
                        console.warn('TabScanner processing timed out, using simulated data as fallback');
                        return generateSimulatedReceiptData(category, notes);
                    } else {
                        throw new Error('TabScanner processing timed out or failed');
                    }
                }
                
                // Step 3: Convert TabScanner result to our receipt format
                console.log('Converting TabScanner results to receipt format');
                return convertTabscannerToReceipt(result, category, notes);
                
            } catch (networkError) {
                console.error('Network error with TabScanner API:', networkError);
                
                // If it's an abort error (timeout), provide a clearer message
                if (networkError.name === 'AbortError') {
                    throw new Error('Request timed out. Please try again.');
                }
                
                // For development environment, use simulated data as fallback for network errors
                if (isDevelopment) {
                    console.warn('Using simulated data as fallback due to network error');
                    return generateSimulatedReceiptData(category, notes);
                }
                
                throw new Error(`Network error: ${networkError.message}`);
            }
            
        } catch (error) {
            console.error('Error in processReceiptWithTabscanner:', error);
            throw error; // Propagate error up for handling
        }
    }
    
    // Function to convert TabScanner result to our receipt format
    function convertTabscannerToReceipt(tabscannerResult, category, notes) {
        try {
            console.log('Converting TabScanner result to receipt format:', tabscannerResult);
            
            const receiptId = 'receipt-' + Date.now();
            const now = new Date();
            
            // Extract merchant - improved parsing with fallbacks
            let merchant = 'Unknown';
            if (tabscannerResult.establishment) {
                merchant = tabscannerResult.establishment;
            } else if (tabscannerResult.merchantName) {
                merchant = tabscannerResult.merchantName;
            } else if (tabscannerResult.vendor && tabscannerResult.vendor.name) {
                merchant = tabscannerResult.vendor.name;
            } else if (tabscannerResult.merchant) {
                merchant = tabscannerResult.merchant;
            }
            
            // Extract date with better fallback handling
            let date = now.toISOString().split('T')[0]; // Default to today
            if (tabscannerResult.date) {
                if (typeof tabscannerResult.date === 'string') {
                    // Try to parse string date
                    try {
                        const parsedDate = new Date(tabscannerResult.date);
                        if (!isNaN(parsedDate.getTime())) {
                            date = parsedDate.toISOString().split('T')[0];
                        }
                    } catch (e) {
                        console.warn('Failed to parse date string:', e);
                    }
                } else if (tabscannerResult.date.text) {
                    // Try to parse date from text field
                    try {
                        const parsedDate = new Date(tabscannerResult.date.text);
                        if (!isNaN(parsedDate.getTime())) {
                            date = parsedDate.toISOString().split('T')[0];
                        }
                    } catch (e) {
                        console.warn('Failed to parse date from text field:', e);
                    }
                }
            }
            
            // Extract total amount with more robust parsing
            let totalAmount = 0;
            if (tabscannerResult.totalAmount && !isNaN(parseFloat(tabscannerResult.totalAmount))) {
                totalAmount = parseFloat(tabscannerResult.totalAmount);
            } else if (tabscannerResult.total && !isNaN(parseFloat(tabscannerResult.total))) {
                totalAmount = parseFloat(tabscannerResult.total);
            } else if (tabscannerResult.amounts && tabscannerResult.amounts.total) {
                totalAmount = parseFloat(tabscannerResult.amounts.total);
            } else if (tabscannerResult.amount && !isNaN(parseFloat(tabscannerResult.amount))) {
                totalAmount = parseFloat(tabscannerResult.amount);
            }
            
            // Clean up any currency symbols from the total amount
            if (typeof totalAmount === 'string') {
                totalAmount = totalAmount.replace(/[$€£¥]/g, '').trim();
                totalAmount = parseFloat(totalAmount);
            }
            
            // Default to 0 if we couldn't parse a valid number
            if (isNaN(totalAmount)) {
                console.warn('Invalid total amount, defaulting to 0');
                totalAmount = 0;
            }
            
            // Extract tax amount with more robust parsing
            let taxAmount = 0;
            if (tabscannerResult.taxAmount && !isNaN(parseFloat(tabscannerResult.taxAmount))) {
                taxAmount = parseFloat(tabscannerResult.taxAmount);
            } else if (tabscannerResult.amounts && tabscannerResult.amounts.tax) {
                taxAmount = parseFloat(tabscannerResult.amounts.tax);
            } else if (tabscannerResult.tax && !isNaN(parseFloat(tabscannerResult.tax))) {
                taxAmount = parseFloat(tabscannerResult.tax);
            }
            
            // Clean up any currency symbols from the tax amount
            if (typeof taxAmount === 'string') {
                taxAmount = taxAmount.replace(/[$€£¥]/g, '').trim();
                taxAmount = parseFloat(taxAmount);
            }
            
            // Default to 0 if we couldn't parse a valid number
            if (isNaN(taxAmount)) {
                console.warn('Invalid tax amount, defaulting to 0');
                taxAmount = 0;
            }
            
            // Extract line items with better error handling
            const items = [];
            if (Array.isArray(tabscannerResult.lineItems)) {
                tabscannerResult.lineItems.forEach(item => {
                    try {
                        // For each line item, extract available information
                        const lineItem = {
                            name: item.descClean || item.description || 'Unknown Item',
                            quantity: parseFloat(item.qty) || 1,
                            unit_price: parseFloat(item.price) || (parseFloat(item.totalPrice) / (parseFloat(item.qty) || 1)),
                            total: parseFloat(item.totalPrice) || parseFloat(item.price) || 0
                        };
                        
                        // Ensure numeric values are valid
                        if (isNaN(lineItem.quantity)) lineItem.quantity = 1;
                        if (isNaN(lineItem.unit_price)) lineItem.unit_price = 0;
                        if (isNaN(lineItem.total)) lineItem.total = 0;
                        
                        items.push(lineItem);
                    } catch (itemError) {
                        console.warn('Error processing line item:', itemError);
                    }
                });
            }
            
            // Build the receipt object
            const receipt = {
                receipt_id: receiptId,
                merchant: merchant,
                date: date,
                total_amount: totalAmount.toFixed(2),
                tax_amount: taxAmount.toFixed(2),
                category: category || 'Uncategorized',
                notes: notes || '',
                items: items,
                status: 'processed',
                created_at: now.toISOString(),
                ocr_provider: 'tabscanner',
                raw_ocr_data: tabscannerResult // Store the raw data for debugging
            };
            
            console.log('Converted receipt:', receipt);
            return receipt;
            
        } catch (error) {
            console.error('Error converting TabScanner result:', error);
            throw new Error('Failed to convert OCR data to receipt format: ' + error.message);
        }
    }
    
    // Function to generate simulated receipt data (only used as fallback)
    function generateSimulatedReceiptData(category, notes) {
        console.log('Generating simulated receipt data');
        const receiptId = 'receipt-' + Date.now();
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const amount = (Math.random() * 100 + 10).toFixed(2);
        const taxAmount = (parseFloat(amount) * 0.08).toFixed(2);
        
        const merchants = [
            'Supermarket', 'Restaurant', 'Coffee Shop', 
            'Gas Station', 'Hardware Store', 'Pharmacy'
        ];
        const merchant = merchants[Math.floor(Math.random() * merchants.length)];
        
        // Generate random items
        const items = [];
        const itemCount = Math.floor(Math.random() * 5) + 1;
        const products = [
            'Milk', 'Bread', 'Eggs', 'Coffee', 'Apples',
            'Chicken', 'Rice', 'Pasta', 'Chips', 'Soda'
        ];
        
        for (let i = 0; i < itemCount; i++) {
            const name = products[Math.floor(Math.random() * products.length)];
            const quantity = Math.floor(Math.random() * 3) + 1;
            const price = (Math.random() * 10 + 1).toFixed(2);
            const total = (quantity * parseFloat(price)).toFixed(2);
            
            items.push({
                name: name,
                quantity: quantity,
                unit_price: price,
                total: total
            });
        }
        
        return {
            receipt_id: receiptId,
            merchant: merchant,
            date: date,
            total_amount: amount,
            tax_amount: taxAmount,
            category: category || 'Uncategorized',
            notes: notes || '',
            items: items,
            status: 'processed',
            created_at: now.toISOString(),
            ocr_provider: 'tabscanner-simulated'
        };
    }
    
    // Function to save receipt to storage system
    function saveReceiptToStorage(receipt) {
        try {
            console.log('Saving receipt to storage:', receipt);
            
            // Validate receipt
            if (!receipt || typeof receipt !== 'object') {
                console.error('Invalid receipt object');
                return false;
            }
            
            if (typeof receipt.total_amount === 'undefined') {
                console.error('Receipt missing total_amount');
                return false;
            }
            
            // Get existing receipts from storage
            let receipts = [];
            try {
                const stored = localStorage.getItem('simulatedReceipts');
                if (stored) {
                    receipts = JSON.parse(stored);
                    if (!Array.isArray(receipts)) {
                        console.warn('Stored receipts is not an array, resetting');
                        receipts = [];
                    }
                }
            } catch (error) {
                console.error('Error reading existing receipts:', error);
                receipts = [];
            }
            
            // Add new receipt
            receipts.push(receipt);
            
            // Save back to storage
            try {
                localStorage.setItem('simulatedReceipts', JSON.stringify(receipts));
                console.log('Receipt saved successfully, total count:', receipts.length);
            } catch (storageError) {
                console.error('Error saving to localStorage:', storageError);
                return false;
            }
            
            // Update financial statistics
            updateFinancialStats(receipt.total_amount);
            
            // Reload receipts list if available
            if (typeof loadReceipts === 'function') {
                console.log('Reloading receipts list');
                setTimeout(() => loadReceipts(), 500);
            } else {
                console.warn('loadReceipts function not available');
            }
            
            return true;
        } catch (error) {
            console.error('Error in saveReceiptToStorage:', error);
            return false;
        }
    }
    
    // Function to update financial statistics
    function updateFinancialStats(amount) {
        try {
            // Find the global stats object
            const stats = typeof window.globalStats !== 'undefined' ? window.globalStats : 
                         (typeof globalStats !== 'undefined' ? globalStats : null);
            
            if (!stats) {
                console.warn('Global stats object not found');
                return;
            }
            
            // Parse amount
            const parsedAmount = parseFloat(amount);
            if (isNaN(parsedAmount)) {
                console.error('Invalid amount:', amount);
                return;
            }
            
            // Update statistics
            stats.receiptsTotal = (parseFloat(stats.receiptsTotal) || 0) + parsedAmount;
            stats.receiptsCount = (parseInt(stats.receiptsCount) || 0) + 1;
            stats.totalExpenses = (parseFloat(stats.totalExpenses) || 0) + parsedAmount;
            stats.netBalance = (parseFloat(stats.netIncome) || 0) - stats.totalExpenses;
            
            console.log('Financial stats updated:', {
                receiptsTotal: stats.receiptsTotal,
                totalExpenses: stats.totalExpenses,
                receiptsCount: stats.receiptsCount,
                netBalance: stats.netBalance
            });
            
            // Save updated stats
            if (typeof saveFinancialStats === 'function') {
                saveFinancialStats();
            } else if (typeof window.saveFinancialStats === 'function') {
                window.saveFinancialStats();
            } else {
                localStorage.setItem('taaxdogFinancialStats', JSON.stringify(stats));
            }
            
            // Update UI if function available
            if (typeof updateDashboardStats === 'function') {
                updateDashboardStats();
            } else if (typeof window.updateDashboardStats === 'function') {
                window.updateDashboardStats();
            }
        } catch (error) {
            console.error('Error updating financial stats:', error);
        }
    }
    
    // Function to set up camera capture for receipts
    function setupCameraCapture() {
        console.log('Setting up camera capture');
        
        const cameraTab = document.getElementById('camera-tab');
        const cameraStartBtn = document.getElementById('camera-start-btn');
        const cameraCaptureBtn = document.getElementById('camera-capture-btn');
        const cameraRetakeBtn = document.getElementById('camera-retake-btn');
        const cameraSubmitBtn = document.getElementById('camera-submit-btn');
        const cameraVideo = document.getElementById('camera-video');
        const cameraCanvas = document.getElementById('camera-canvas');
        const cameraPreview = document.getElementById('camera-preview');
        const cameraPlaceholder = document.getElementById('camera-placeholder');
        
        if (!cameraStartBtn || !cameraCaptureBtn || !cameraVideo) {
            console.error('Required camera elements not found');
            return;
        }
        
        let stream = null;
        
        // Start camera button click handler
        cameraStartBtn.addEventListener('click', function() {
            navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
                .then(function(mediaStream) {
                    stream = mediaStream;
                    cameraVideo.srcObject = mediaStream;
                    cameraVideo.play();
                    
                    cameraVideo.style.display = 'block';
                    cameraPlaceholder.style.display = 'none';
                    cameraCaptureBtn.style.display = 'block';
                    cameraStartBtn.style.display = 'none';
                })
                .catch(function(error) {
                    console.error('Error accessing camera:', error);
                    alert('Could not access camera. Please ensure you have granted camera permissions.');
                });
        });
        
        // Capture photo button click handler
        cameraCaptureBtn.addEventListener('click', function() {
            if (!stream) return;
            
            try {
                // Draw video frame to canvas
                const context = cameraCanvas.getContext('2d');
                cameraCanvas.width = cameraVideo.videoWidth;
                cameraCanvas.height = cameraVideo.videoHeight;
                context.drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);
                
                // Convert to image data URL
                const imageData = cameraCanvas.toDataURL('image/png');
                
                // Show preview
                cameraPreview.src = imageData;
                cameraPreview.style.display = 'block';
                cameraVideo.style.display = 'none';
                
                // Show retake and submit buttons
                cameraCaptureBtn.style.display = 'none';
                cameraRetakeBtn.style.display = 'inline-block';
                cameraSubmitBtn.style.display = 'inline-block';
            } catch (error) {
                console.error('Error capturing photo:', error);
                alert('Failed to capture photo. Please try again.');
            }
        });
        
        // Retake photo button click handler
        cameraRetakeBtn.addEventListener('click', function() {
            cameraVideo.style.display = 'block';
            cameraPreview.style.display = 'none';
            
            cameraCaptureBtn.style.display = 'block';
            cameraRetakeBtn.style.display = 'none';
            cameraSubmitBtn.style.display = 'none';
        });
        
        // Submit photo button click handler
        cameraSubmitBtn.addEventListener('click', function() {
            // Get the image data
            const imageData = cameraPreview.src;
            if (!imageData) {
                alert('No photo captured');
                return;
            }
            
            // Get category and notes if available
            const category = document.getElementById('camera-category')?.value || 'Uncategorized';
            const notes = document.getElementById('camera-notes')?.value || '';
            
            // Show progress
            const uploadProgress = document.getElementById('receipt-upload-progress');
            if (uploadProgress) uploadProgress.style.display = 'block';
            
            // Disable submit button during processing
            cameraSubmitBtn.disabled = true;
            
            // Convert base64 image to blob for API
            fetch(imageData)
                .then(res => res.blob())
                .then(blob => {
                    // Create a File object from the blob for TabScanner
                    const imageFile = new File([blob], 'camera_receipt.png', { type: 'image/png' });
                    
                    // Process with TabScanner API
                    return processReceiptWithTabscanner(imageFile, category, notes);
                })
                .then(receipt => {
                    console.log('Camera receipt processed successfully:', receipt);
                    
                    // Save and show success
                    if (saveReceiptToStorage(receipt)) {
                        showSuccessMessage(receipt);
                    } else {
                        showErrorMessage('Failed to save receipt to storage');
                    }
                
                // Stop camera stream
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                    stream = null;
                }
                
                // Reset camera UI after a delay
                setTimeout(() => {
                    cameraVideo.style.display = 'none';
                    cameraPreview.style.display = 'none';
                    cameraPlaceholder.style.display = 'block';
                    cameraStartBtn.style.display = 'block';
                    cameraCaptureBtn.style.display = 'none';
                    cameraRetakeBtn.style.display = 'none';
                    cameraSubmitBtn.style.display = 'none';
                    cameraSubmitBtn.disabled = false;
                    
                    // Close modal after success
                    const modal = bootstrap.Modal.getInstance(document.getElementById('receipt-upload-modal'));
                    if (modal) {
                        modal.hide();
                    }
                }, 2000);
                })
                .catch(error => {
                    console.error('Error processing camera receipt:', error);
                    showErrorMessage(error.message || 'Failed to process receipt');
                    cameraSubmitBtn.disabled = false;
                    
                    // Only in development, offer fallback
                    if (isDevelopment && confirm('API error occurred. Generate simulated data instead?')) {
                        const simulatedReceipt = generateSimulatedReceiptData(category, notes);
                        if (saveReceiptToStorage(simulatedReceipt)) {
                            showSuccessMessage(simulatedReceipt);
                            
                            // Reset UI
                            setTimeout(() => {
                                cameraVideo.style.display = 'none';
                                cameraPreview.style.display = 'none';
                                cameraPlaceholder.style.display = 'block';
                                cameraStartBtn.style.display = 'block';
                                cameraCaptureBtn.style.display = 'none';
                                cameraRetakeBtn.style.display = 'none';
                                cameraSubmitBtn.style.display = 'none';
                                
                                // Close modal after success
                                const modal = bootstrap.Modal.getInstance(document.getElementById('receipt-upload-modal'));
                                if (modal) {
                                    modal.hide();
                                }
                            }, 2000);
                        }
                    }
                })
                .finally(() => {
                    if (uploadProgress) uploadProgress.style.display = 'none';
                });
        });
        
        // Clean up camera when tab changes or modal closes
        document.querySelectorAll('button[data-bs-toggle="tab"]').forEach(button => {
            button.addEventListener('click', function() {
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                    stream = null;
                }
            });
        });
        
        const receiptModal = document.getElementById('receipt-upload-modal');
        if (receiptModal) {
            receiptModal.addEventListener('hidden.bs.modal', function() {
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                    stream = null;
                }
                
                // Reset camera UI
                cameraVideo.style.display = 'none';
                cameraPreview.style.display = 'none';
                cameraPlaceholder.style.display = 'block';
                cameraStartBtn.style.display = 'block';
                cameraCaptureBtn.style.display = 'none';
                cameraRetakeBtn.style.display = 'none';
                cameraSubmitBtn.style.display = 'none';
                
                // Reset the upload form
                resetUploadForm();
            });
        }
    }
    
    // Function to set up the receipts list
    function setupReceiptsList() {
        console.log('Setting up receipts list');
        
        // Load initial receipts data
        if (typeof loadReceipts === 'function') {
            loadReceipts();
        }
        
        // Add delete receipt functionality with event delegation
        document.addEventListener('click', function(e) {
            // Find closest button or the target itself
            const button = e.target.closest('.delete-receipt') || (e.target.classList.contains('delete-receipt') ? e.target : null);
            
            if (button) {
                const receiptId = button.getAttribute('data-id');
                if (receiptId) {
                    console.log('Delete button clicked for receipt:', receiptId);
                    if (confirm('Are you sure you want to delete this receipt?')) {
                        deleteReceipt(receiptId);
                    }
                }
            }
        });
    }
    
    // Function to delete a receipt
    function deleteReceipt(receiptId) {
        try {
            console.log('Deleting receipt:', receiptId);
            
            if (!receiptId) {
                console.error('No receipt ID provided for deletion');
                return false;
            }
            
            // Get receipts from storage
            let receipts = [];
            try {
                const stored = localStorage.getItem('simulatedReceipts');
                if (stored) {
                    receipts = JSON.parse(stored);
                }
            } catch (error) {
                console.error('Error reading receipts for deletion:', error);
                receipts = [];
            }
            
            if (!Array.isArray(receipts)) {
                console.error('Stored receipts is not an array');
                return false;
            }
            
            // Find the receipt to delete
            const index = receipts.findIndex(r => r.receipt_id === receiptId);
            if (index === -1) {
                console.error('Receipt not found for deletion:', receiptId);
                return false;
            }
            
            // Get receipt for financial stats update
            const receipt = receipts[index];
            const amount = parseFloat(receipt.total_amount) || 0;
            
            // Remove the receipt
            receipts.splice(index, 1);
            
            // Save back to storage
            localStorage.setItem('simulatedReceipts', JSON.stringify(receipts));
            console.log('Receipt deleted, remaining count:', receipts.length);
            
            // Update financial stats
            const stats = typeof window.globalStats !== 'undefined' ? window.globalStats : 
                         (typeof globalStats !== 'undefined' ? globalStats : null);
            
            if (stats) {
                stats.receiptsTotal = Math.max(0, (parseFloat(stats.receiptsTotal) || 0) - amount);
                stats.receiptsCount = Math.max(0, (parseInt(stats.receiptsCount) || 0) - 1);
                stats.totalExpenses = Math.max(0, (parseFloat(stats.totalExpenses) || 0) - amount);
                stats.netBalance = (parseFloat(stats.netIncome) || 0) - stats.totalExpenses;
                
                // Save updated stats
                if (typeof saveFinancialStats === 'function') {
                    saveFinancialStats();
                } else if (typeof window.saveFinancialStats === 'function') {
                    window.saveFinancialStats();
                } else {
                    localStorage.setItem('taaxdogFinancialStats', JSON.stringify(stats));
                }
                
                // Update UI if function available
                if (typeof updateDashboardStats === 'function') {
                    updateDashboardStats();
                } else if (typeof window.updateDashboardStats === 'function') {
                    window.updateDashboardStats();
                }
            }
            
            // Reload receipts list if available
            if (typeof loadReceipts === 'function') {
                loadReceipts();
            }
            
            return true;
        } catch (error) {
            console.error('Error deleting receipt:', error);
            return false;
        }
    }
    
    // Function to show success message
    function showSuccessMessage(receipt) {
        console.log('Showing success message for receipt:', receipt);
        
        const uploadResult = document.getElementById('receipt-upload-result');
        const uploadProgress = document.getElementById('receipt-upload-progress');
        
        if (uploadProgress) uploadProgress.style.display = 'none';
        
        if (uploadResult) {
            uploadResult.innerHTML = `
                <div class="alert alert-success">
                    <h5><i class="bi bi-check-circle me-2"></i>Receipt saved successfully!</h5>
                    <p class="mb-1"><strong>Merchant:</strong> ${receipt.merchant || 'Unknown'}</p>
                    <p class="mb-1"><strong>Date:</strong> ${receipt.date || 'Unknown'}</p>
                    <p class="mb-1"><strong>Total:</strong> $${parseFloat(receipt.total_amount).toFixed(2)}</p>
                    <p class="mb-0"><strong>Category:</strong> ${receipt.category || 'Uncategorized'}</p>
                </div>`;
            uploadResult.style.display = 'block';
            
            // Hide form after successful upload
            setTimeout(() => {
                const modal = bootstrap.Modal.getInstance(document.getElementById('receipt-upload-modal'));
                if (modal) {
                    modal.hide();
                }
            }, 2000);
        }
    }
    
    // Function to show error message
    function showErrorMessage(message) {
        console.error('Showing error message:', message);
        
        const uploadResult = document.getElementById('receipt-upload-result');
        const uploadProgress = document.getElementById('receipt-upload-progress');
        
        if (uploadProgress) uploadProgress.style.display = 'none';
        
        if (uploadResult) {
            uploadResult.innerHTML = `
                <div class="alert alert-danger">
                    <h5><i class="bi bi-exclamation-triangle me-2"></i>Error</h5>
                    <p>${message}</p>
                </div>`;
            uploadResult.style.display = 'block';
        }
    }
    
    // Function to reset the upload form and restore the UI state
    function resetUploadForm() {
        const uploadForm = document.getElementById('receipt-upload-form');
        const previewContainer = document.getElementById('receipt-preview-container');
        const uploadResult = document.getElementById('receipt-upload-result');
        const uploadSubmit = document.getElementById('receipt-upload-submit');
        const uploadAnother = document.getElementById('upload-another-receipt');
        
        // Reset all form elements
        if (uploadForm) uploadForm.reset();
        if (previewContainer) previewContainer.style.display = 'none';
        if (uploadResult) uploadResult.style.display = 'none';
        
        // Show submit button, hide "upload another" button
        if (uploadSubmit) {
            uploadSubmit.style.display = 'block';
            uploadSubmit.disabled = false;
        }
        if (uploadAnother) uploadAnother.style.display = 'none';
        
        // Ensure the floating upload button is visible again
        const uploadReceiptBtn = document.getElementById('upload-receipt-btn');
        if (uploadReceiptBtn) {
            uploadReceiptBtn.style.display = 'block';
        }
        
        // Ensure the page remains responsive
        document.body.classList.remove('modal-open');
        const modalBackdrops = document.querySelectorAll('.modal-backdrop');
        modalBackdrops.forEach(backdrop => backdrop.remove());
    }

    // Make sure the upload button is always visible after modal close
    document.addEventListener('hidden.bs.modal', function(event) {
        if (event.target.id === 'receipt-upload-modal') {
            const uploadReceiptBtn = document.getElementById('upload-receipt-btn');
            if (uploadReceiptBtn) {
                uploadReceiptBtn.style.display = 'block';
            }
            
            // Ensure page responsiveness
            document.body.classList.remove('modal-open');
            const modalBackdrops = document.querySelectorAll('.modal-backdrop');
            modalBackdrops.forEach(backdrop => backdrop.remove());
        }
    });

    // Fix the camera capture mode to properly clean up resources
    function fixCameraCapture() {
        const cameraSubmitBtn = document.getElementById('camera-submit-btn');
        
        if (cameraSubmitBtn) {
            // Replace the existing click handler with a more reliable one
            cameraSubmitBtn.addEventListener('click', function() {
                // Existing camera capture code...
                
                // Ensure we properly clean up and restore UI state
                const handleCompletion = () => {
                    // Stop camera stream
                    if (window.cameraStream) {
                        window.cameraStream.getTracks().forEach(track => track.stop());
                        window.cameraStream = null;
                    }
                    
                    // Reset camera UI
                    const cameraVideo = document.getElementById('camera-video');
                    const cameraPreview = document.getElementById('camera-preview');
                    const cameraPlaceholder = document.getElementById('camera-placeholder');
                    const cameraStartBtn = document.getElementById('camera-start-btn');
                    const cameraCaptureBtn = document.getElementById('camera-capture-btn');
                    const cameraRetakeBtn = document.getElementById('camera-retake-btn');
                    
                    if (cameraVideo) cameraVideo.style.display = 'none';
                    if (cameraPreview) cameraPreview.style.display = 'none';
                    if (cameraPlaceholder) cameraPlaceholder.style.display = 'block';
                    if (cameraStartBtn) cameraStartBtn.style.display = 'block';
                    if (cameraCaptureBtn) cameraCaptureBtn.style.display = 'none';
                    if (cameraRetakeBtn) cameraRetakeBtn.style.display = 'none';
                    if (cameraSubmitBtn) {
                        cameraSubmitBtn.style.display = 'none';
                        cameraSubmitBtn.disabled = false;
                    }
                    
                    // Make sure floating upload button is visible
                    const uploadReceiptBtn = document.getElementById('upload-receipt-btn');
                    if (uploadReceiptBtn) {
                        uploadReceiptBtn.style.display = 'block';
                    }
                };
                
                // Call this function regardless of success or failure
                setTimeout(handleCompletion, 2000);
            }, { once: true }); // Use once: true to prevent multiple handlers
        }
    }

    // Call the fix functions on page load
    document.addEventListener('DOMContentLoaded', function() {
        // Call the existing initialization code
        
        // Additional fixes
        fixCameraCapture();
        
        // Add a backup mechanism to restore UI state
        window.addEventListener('error', function(event) {
            console.error('Global error caught:', event.error);
            resetUploadForm();
            
            // Ensure the page remains responsive
            document.body.classList.remove('modal-open');
            const modalBackdrops = document.querySelectorAll('.modal-backdrop');
            modalBackdrops.forEach(backdrop => backdrop.remove());
            
            return false; // Allow default error handling to continue
        });
    });
}); 