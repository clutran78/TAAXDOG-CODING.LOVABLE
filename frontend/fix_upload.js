// Script to handle the receipt upload in development mode
document.addEventListener('DOMContentLoaded', function() {
    console.log('Setting up development mode receipt upload handler');
    
    // Check if we're in development mode
    const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isDevelopment) return;
    
    // Setup manual entry form
    setupManualEntryForm();
    
    // Setup upload form
    setupUploadForm();
    
    // Setup camera capture
    setupCameraCapture();
    
    // Setup the Create Mock Receipt button
    setupMockReceiptButton();
    
    console.log('Development mode receipt handler set up successfully');
    
    // Generate a unique ID for receipts
    function generateReceiptId() {
        return 'receipt-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    }
    
    // Function to set up the manual entry form
    function setupManualEntryForm() {
        const manualForm = document.getElementById('manual-receipt-form');
        const manualSubmit = document.getElementById('manual-submit');
        const addItemBtn = document.getElementById('add-item-btn');
        const itemsContainer = document.getElementById('manual-items-container');
        
        if (!manualForm || !manualSubmit) {
            console.error('Could not find manual form elements');
            return;
        }
        
        // Add event listener to add item button
        if (addItemBtn && itemsContainer) {
            addItemBtn.addEventListener('click', function() {
                const itemRow = document.createElement('div');
                itemRow.className = 'row receipt-item mb-2';
                itemRow.innerHTML = `
                    <div class="col-5">
                        <input type="text" class="form-control form-control-sm item-name" placeholder="Item name">
                    </div>
                    <div class="col-2">
                        <input type="number" class="form-control form-control-sm item-quantity" placeholder="Qty" min="1" value="1">
                    </div>
                    <div class="col-3">
                        <div class="input-group input-group-sm">
                            <span class="input-group-text">$</span>
                            <input type="number" step="0.01" min="0" class="form-control form-control-sm item-price" placeholder="Price">
                        </div>
                    </div>
                    <div class="col-2">
                        <button type="button" class="btn btn-sm btn-outline-danger remove-item">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
                
                itemsContainer.appendChild(itemRow);
                
                // Add event listener to the remove button
                const removeBtn = itemRow.querySelector('.remove-item');
                if (removeBtn) {
                    removeBtn.addEventListener('click', function() {
                        itemRow.remove();
                    });
                }
            });
        }
        
        // Handle form submission
        if (manualSubmit) {
            manualSubmit.addEventListener('click', function() {
                // Get form values
                const merchant = document.getElementById('manual-merchant').value;
                const date = document.getElementById('manual-date').value;
                const total = document.getElementById('manual-total').value;
                const tax = document.getElementById('manual-tax').value || '0';
                const category = document.getElementById('manual-category').value;
                const notes = document.getElementById('manual-notes').value;
                
                // Validate required fields
                if (!merchant || !date || !total) {
                    alert('Please fill in all required fields (Merchant, Date, Total Amount)');
                    return;
                }
                
                // Collect items if any
                const items = [];
                const itemRows = itemsContainer ? itemsContainer.querySelectorAll('.receipt-item') : [];
                
                itemRows.forEach(row => {
                    const name = row.querySelector('.item-name').value;
                    const quantity = row.querySelector('.item-quantity').value;
                    const unitPrice = row.querySelector('.item-price').value;
                    
                    if (name && quantity && unitPrice) {
                        const total = (parseFloat(quantity) * parseFloat(unitPrice)).toFixed(2);
                        items.push({
                            name: name,
                            quantity: parseInt(quantity),
                            unit_price: parseFloat(unitPrice).toFixed(2),
                            total: total
                        });
                    }
                });
                
                // Add tax as a separate item if provided
                if (tax && parseFloat(tax) > 0) {
                    items.push({
                        name: 'Tax',
                        quantity: 1,
                        unit_price: parseFloat(tax).toFixed(2),
                        total: parseFloat(tax).toFixed(2)
                    });
                }
                
                // Create receipt object
                const receipt = {
                    receipt_id: generateReceiptId(),
                    merchant: merchant,
                    date: date,
                    total_amount: parseFloat(total).toFixed(2),
                    tax_amount: tax ? parseFloat(tax).toFixed(2) : '0.00',
                    category: category || 'Uncategorized',
                    notes: notes || '',
                    items: items,
                    status: 'processed',
                    created_at: new Date().toISOString()
                };
                
                // Save receipt to localStorage
                saveReceiptAndUpdateStats(receipt);
                
                // Show success message
                showSuccessMessage(receipt);
                
                // Reset form
                manualForm.reset();
                if (itemsContainer) {
                    itemsContainer.innerHTML = '';
                }
                
                // Close modal after a delay
                setTimeout(() => {
                    const modal = bootstrap.Modal.getInstance(document.getElementById('receipt-upload-modal'));
                    if (modal) {
                        modal.hide();
                    }
                }, 2000);
            });
        }
    }
    
    // Function to set up image upload form
    function setupUploadForm() {
        const uploadForm = document.getElementById('receipt-upload-form');
        const uploadSubmit = document.getElementById('receipt-upload-submit');
        const fileInput = document.getElementById('receipt-image');
        const previewContainer = document.getElementById('receipt-preview-container');
        const receiptPreview = document.getElementById('receipt-preview');
        
        if (!uploadForm || !uploadSubmit) {
            console.error('Could not find upload form elements');
            return;
        }
        
        // Override the default submit handler
        uploadForm.addEventListener('submit', function(e) {
            e.preventDefault();
            console.log('Form submit intercepted in development mode');
        });
        
        // Preview image when selected
        if (fileInput && previewContainer && receiptPreview) {
            fileInput.addEventListener('change', function() {
                if (this.files && this.files[0]) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        receiptPreview.src = e.target.result;
                        previewContainer.style.display = 'block';
                    };
                    reader.readAsDataURL(this.files[0]);
                }
            });
        }
        
        // Handle upload button click
        uploadSubmit.onclick = function(e) {
            e.preventDefault();
            
            console.log('Upload button clicked - using dev mode handler');
            
            // Get the form elements
            const fileInput = document.getElementById('receipt-image');
            const category = document.getElementById('receipt-category').value;
            const notes = document.getElementById('receipt-notes').value;
            const ocrProvider = document.getElementById('receipt-ocr-provider').value;
            const uploadProgress = document.getElementById('receipt-upload-progress');
            const uploadResult = document.getElementById('receipt-upload-result');
            const uploadAnother = document.getElementById('upload-another-receipt');
            
            if (!fileInput || !fileInput.files || !fileInput.files[0]) {
                alert('Please select a receipt image to upload');
                return;
            }
            
            // Show progress
            if (uploadProgress) {
                uploadProgress.style.display = 'block';
                
                const progressBar = uploadProgress.querySelector('.progress-bar');
                if (progressBar) {
                    progressBar.style.width = '0%';
                    
                    // Simulate progress
                    let progress = 0;
                    const progressInterval = setInterval(() => {
                        progress += 5;
                        progressBar.style.width = `${progress}%`;
                        
                        if (progress >= 100) {
                            clearInterval(progressInterval);
                        }
                    }, 100);
                }
            }
            
            if (uploadResult) uploadResult.style.display = 'none';
            uploadSubmit.disabled = true;
            
            // Process the receipt image
            const reader = new FileReader();
            reader.onload = function(e) {
                // Simulate OCR processing time (1-2 seconds)
                setTimeout(() => {
                    // Generate simulated OCR data based on the date
                    const today = new Date();
                    const randomAmount = (Math.random() * 145 + 5).toFixed(2);
                    const taxAmount = (randomAmount * 0.0825).toFixed(2); // Approx 8.25% tax
                    
                    // Use current date for the receipt
                    const date = today.toISOString().split('T')[0];
                    
                    // Get a random merchant
                    const merchants = [
                        'Grocery Mart', 'Coffee Shop', 'Office Supplies', 
                        'Restaurant', 'Gas Station', 'Hardware Store',
                        'Electronics Store', 'Clothing Store', 'Pharmacy'
                    ];
                    const merchant = merchants[Math.floor(Math.random() * merchants.length)];
                    
                    // Create 1-3 random items
                    const itemCount = Math.floor(Math.random() * 3) + 1;
                    const items = [];
                    
                    for (let i = 0; i < itemCount; i++) {
                        const itemName = `Item ${i+1}`;
                        const quantity = Math.floor(Math.random() * 3) + 1;
                        const unitPrice = (Math.random() * 20 + 5).toFixed(2);
                        const total = (quantity * unitPrice).toFixed(2);
                        
                        items.push({
                            name: itemName,
                            quantity: quantity,
                            unit_price: unitPrice,
                            total: total
                        });
                    }
                    
                    // Add tax as a separate item
                    items.push({
                        name: 'Tax',
                        quantity: 1,
                        unit_price: taxAmount,
                        total: taxAmount
                    });
                    
                    // Create the receipt object
                    const receipt = {
                        receipt_id: generateReceiptId(),
                        merchant: merchant,
                        date: date,
                        total_amount: randomAmount,
                        tax_amount: taxAmount,
                        category: category || 'Uncategorized',
                        notes: notes || '',
                        image: e.target.result,
                        items: items,
                        status: 'processed',
                        created_at: new Date().toISOString()
                    };
                    
                    // First show the extracted data and ask for confirmation
                    if (uploadProgress) uploadProgress.style.display = 'none';
                    if (uploadResult) {
                        uploadResult.innerHTML = `
                            <div class="card mb-3">
                                <div class="card-header bg-light">
                                    <h6 class="mb-0">Extracted Receipt Data</h6>
                                </div>
                                <div class="card-body">
                                    <div class="row mb-3">
                                        <div class="col-md-6">
                                            <label class="form-label">Merchant</label>
                                            <input type="text" class="form-control" id="extracted-merchant" value="${receipt.merchant}">
                                        </div>
                                        <div class="col-md-6">
                                            <label class="form-label">Date</label>
                                            <input type="date" class="form-control" id="extracted-date" value="${receipt.date}">
                                        </div>
                                    </div>
                                    <div class="row mb-3">
                                        <div class="col-md-6">
                                            <label class="form-label">Total Amount</label>
                                            <div class="input-group">
                                                <span class="input-group-text">$</span>
                                                <input type="number" step="0.01" min="0" class="form-control" id="extracted-total" value="${receipt.total_amount}">
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <label class="form-label">Tax Amount</label>
                                            <div class="input-group">
                                                <span class="input-group-text">$</span>
                                                <input type="number" step="0.01" min="0" class="form-control" id="extracted-tax" value="${receipt.tax_amount}">
                                            </div>
                                        </div>
                                    </div>
                                    <div class="alert alert-info">
                                        <i class="fas fa-info-circle me-2"></i>You can edit any incorrect values before saving.
                                    </div>
                                </div>
                                <div class="card-footer text-end">
                                    <button type="button" class="btn btn-primary" id="confirm-extracted-data">
                                        <i class="fas fa-check me-2"></i>Save Receipt
                                    </button>
                                </div>
                            </div>
                        `;
                        uploadResult.style.display = 'block';
                        
                        // Add event listener to the confirm button
                        const confirmBtn = document.getElementById('confirm-extracted-data');
                        if (confirmBtn) {
                            confirmBtn.addEventListener('click', function() {
                                // Get the edited values
                                const editedMerchant = document.getElementById('extracted-merchant').value;
                                const editedDate = document.getElementById('extracted-date').value;
                                const editedTotal = document.getElementById('extracted-total').value;
                                const editedTax = document.getElementById('extracted-tax').value;
                                
                                // Update the receipt object
                                receipt.merchant = editedMerchant;
                                receipt.date = editedDate;
                                receipt.total_amount = parseFloat(editedTotal).toFixed(2);
                                receipt.tax_amount = parseFloat(editedTax).toFixed(2);
                                
                                // Save the receipt and update stats
                                saveReceiptAndUpdateStats(receipt);
                                
                                // Show success message
                                showSuccessMessage(receipt);
                                
                                // Enable the Upload Another button
                                if (uploadAnother) {
                                    uploadAnother.style.display = 'inline-block';
                                    uploadAnother.onclick = function() {
                                        // Reset the form
                                        uploadForm.reset();
                                        if (previewContainer) previewContainer.style.display = 'none';
                                        if (uploadResult) uploadResult.style.display = 'none';
                                        uploadAnother.style.display = 'none';
                                        uploadSubmit.disabled = false;
                                    };
                                }
                                
                                // Close modal after a delay
                                setTimeout(() => {
                                    const modal = bootstrap.Modal.getInstance(document.getElementById('receipt-upload-modal'));
                                    if (modal) {
                                        modal.hide();
                                    }
                                }, 2000);
                            });
                        }
                    }
                    
                    uploadSubmit.disabled = false;
                }, 1500); // Simulated OCR processing time
            };
            
            reader.readAsDataURL(fileInput.files[0]);
        };
    }
    
    // Function to set up camera capture
    function setupCameraCapture() {
        const cameraStartBtn = document.getElementById('camera-start-btn');
        const cameraCaptureBtn = document.getElementById('camera-capture-btn');
        const cameraRetakeBtn = document.getElementById('camera-retake-btn');
        const cameraSubmitBtn = document.getElementById('camera-submit-btn');
        const cameraVideo = document.getElementById('camera-video');
        const cameraCanvas = document.getElementById('camera-canvas');
        const cameraPreview = document.getElementById('camera-preview');
        const cameraPlaceholder = document.getElementById('camera-placeholder');
        
        if (!cameraStartBtn || !cameraCaptureBtn || !cameraVideo || !cameraCanvas || !cameraPreview) {
            console.error('Could not find camera elements');
            return;
        }
        
        let stream = null;
        
        // Start camera when button is clicked
        cameraStartBtn.addEventListener('click', function() {
            // Request camera access
            navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
                .then(function(mediaStream) {
                    stream = mediaStream;
                    cameraVideo.srcObject = mediaStream;
                    cameraVideo.style.display = 'block';
                    cameraPlaceholder.style.display = 'none';
                    cameraCaptureBtn.style.display = 'block';
                    cameraStartBtn.style.display = 'none';
                })
                .catch(function(err) {
                    console.error('Error accessing camera:', err);
                    alert('Could not access camera. Please make sure you have granted permission or try using a different browser.');
                });
        });
        
        // Capture photo when button is clicked
        cameraCaptureBtn.addEventListener('click', function() {
            // Draw video frame to canvas
            const context = cameraCanvas.getContext('2d');
            cameraCanvas.width = cameraVideo.videoWidth;
            cameraCanvas.height = cameraVideo.videoHeight;
            context.drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);
            
            // Get image data
            const imageData = cameraCanvas.toDataURL('image/png');
            
            // Display captured image
            cameraPreview.src = imageData;
            cameraPreview.style.display = 'block';
            cameraVideo.style.display = 'none';
            
            // Show retake and submit buttons
            cameraRetakeBtn.style.display = 'block';
            cameraSubmitBtn.style.display = 'block';
            cameraCaptureBtn.style.display = 'none';
        });
        
        // Retake photo when button is clicked
        cameraRetakeBtn.addEventListener('click', function() {
            cameraVideo.style.display = 'block';
            cameraPreview.style.display = 'none';
            cameraCaptureBtn.style.display = 'block';
            cameraRetakeBtn.style.display = 'none';
            cameraSubmitBtn.style.display = 'none';
        });
        
        // Submit photo when button is clicked
        cameraSubmitBtn.addEventListener('click', function() {
            // Get the image data
            const imageData = cameraPreview.src;
            
            // Show progress
            const uploadProgress = document.getElementById('receipt-upload-progress');
            const uploadResult = document.getElementById('receipt-upload-result');
            
            if (uploadProgress) {
                uploadProgress.style.display = 'block';
                
                const progressBar = uploadProgress.querySelector('.progress-bar');
                if (progressBar) {
                    progressBar.style.width = '0%';
                    
                    // Simulate progress
                    let progress = 0;
                    const progressInterval = setInterval(() => {
                        progress += 5;
                        progressBar.style.width = `${progress}%`;
                        
                        if (progress >= 100) {
                            clearInterval(progressInterval);
                        }
                    }, 100);
                }
            }
            
            if (uploadResult) uploadResult.style.display = 'none';
            cameraSubmitBtn.disabled = true;
            
            // Process the receipt (simulate OCR)
            setTimeout(() => {
                // Generate simulated OCR data
                const today = new Date();
                const randomAmount = (Math.random() * 145 + 5).toFixed(2);
                const taxAmount = (randomAmount * 0.0825).toFixed(2); // Approx 8.25% tax
                
                // Use current date for the receipt
                const date = today.toISOString().split('T')[0];
                
                // Get a random merchant
                const merchants = [
                    'Grocery Mart', 'Coffee Shop', 'Office Supplies', 
                    'Restaurant', 'Gas Station', 'Hardware Store',
                    'Electronics Store', 'Clothing Store', 'Pharmacy'
                ];
                const merchant = merchants[Math.floor(Math.random() * merchants.length)];
                
                // Create 1-3 random items
                const itemCount = Math.floor(Math.random() * 3) + 1;
                const items = [];
                
                for (let i = 0; i < itemCount; i++) {
                    const itemName = `Item ${i+1}`;
                    const quantity = Math.floor(Math.random() * 3) + 1;
                    const unitPrice = (Math.random() * 20 + 5).toFixed(2);
                    const total = (quantity * unitPrice).toFixed(2);
                    
                    items.push({
                        name: itemName,
                        quantity: quantity,
                        unit_price: unitPrice,
                        total: total
                    });
                }
                
                // Add tax as a separate item
                items.push({
                    name: 'Tax',
                    quantity: 1,
                    unit_price: taxAmount,
                    total: taxAmount
                });
                
                // Create the receipt object
                const receipt = {
                    receipt_id: generateReceiptId(),
                    merchant: merchant,
                    date: date,
                    total_amount: randomAmount,
                    tax_amount: taxAmount,
                    category: 'Uncategorized',
                    notes: '',
                    image: imageData,
                    items: items,
                    status: 'processed',
                    created_at: new Date().toISOString()
                };
                
                // Show extracted data for confirmation
                if (uploadProgress) uploadProgress.style.display = 'none';
                if (uploadResult) {
                    uploadResult.innerHTML = `
                        <div class="card mb-3">
                            <div class="card-header bg-light">
                                <h6 class="mb-0">Extracted Receipt Data</h6>
                            </div>
                            <div class="card-body">
                                <div class="row mb-3">
                                    <div class="col-md-6">
                                        <label class="form-label">Merchant</label>
                                        <input type="text" class="form-control" id="camera-merchant" value="${receipt.merchant}">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Date</label>
                                        <input type="date" class="form-control" id="camera-date" value="${receipt.date}">
                                    </div>
                                </div>
                                <div class="row mb-3">
                                    <div class="col-md-6">
                                        <label class="form-label">Total Amount</label>
                                        <div class="input-group">
                                            <span class="input-group-text">$</span>
                                            <input type="number" step="0.01" min="0" class="form-control" id="camera-total" value="${receipt.total_amount}">
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Tax Amount</label>
                                        <div class="input-group">
                                            <span class="input-group-text">$</span>
                                            <input type="number" step="0.01" min="0" class="form-control" id="camera-tax" value="${receipt.tax_amount}">
                                        </div>
                                    </div>
                                </div>
                                <div class="row mb-3">
                                    <div class="col-md-6">
                                        <label class="form-label">Category</label>
                                        <select class="form-select" id="camera-category">
                                            <option value="Food and Dining">Food and Dining</option>
                                            <option value="Shopping">Shopping</option>
                                            <option value="Travel">Travel</option>
                                            <option value="Entertainment">Entertainment</option>
                                            <option value="Office">Office</option>
                                            <option value="Groceries">Groceries</option>
                                            <option value="Automotive">Automotive</option>
                                            <option value="Utilities">Utilities</option>
                                            <option value="Healthcare">Healthcare</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Notes (Optional)</label>
                                        <textarea class="form-control" id="camera-notes" rows="1"></textarea>
                                    </div>
                                </div>
                                <div class="alert alert-info">
                                    <i class="fas fa-info-circle me-2"></i>You can edit any incorrect values before saving.
                                </div>
                            </div>
                            <div class="card-footer text-end">
                                <button type="button" class="btn btn-primary" id="confirm-camera-data">
                                    <i class="fas fa-check me-2"></i>Save Receipt
                                </button>
                            </div>
                        </div>
                    `;
                    uploadResult.style.display = 'block';
                    
                    // Add event listener to the confirm button
                    const confirmBtn = document.getElementById('confirm-camera-data');
                    if (confirmBtn) {
                        confirmBtn.addEventListener('click', function() {
                            // Get the edited values
                            const editedMerchant = document.getElementById('camera-merchant').value;
                            const editedDate = document.getElementById('camera-date').value;
                            const editedTotal = document.getElementById('camera-total').value;
                            const editedTax = document.getElementById('camera-tax').value;
                            const editedCategory = document.getElementById('camera-category').value;
                            const editedNotes = document.getElementById('camera-notes').value;
                            
                            // Update the receipt object
                            receipt.merchant = editedMerchant;
                            receipt.date = editedDate;
                            receipt.total_amount = parseFloat(editedTotal).toFixed(2);
                            receipt.tax_amount = parseFloat(editedTax).toFixed(2);
                            receipt.category = editedCategory;
                            receipt.notes = editedNotes;
                            
                            // Save the receipt and update stats
                            saveReceiptAndUpdateStats(receipt);
                            
                            // Show success message
                            showSuccessMessage(receipt);
                            
                            // Stop camera stream
                            if (stream) {
                                stream.getTracks().forEach(track => track.stop());
                                stream = null;
                            }
                            
                            // Close modal after a delay
                            setTimeout(() => {
                                const modal = bootstrap.Modal.getInstance(document.getElementById('receipt-upload-modal'));
                                if (modal) {
                                    modal.hide();
                                }
                            }, 2000);
                        });
                    }
                }
                
                cameraSubmitBtn.disabled = false;
            }, 1500); // Simulated OCR processing time
        });
        
        // Clean up when tab switched or modal closed
        document.querySelectorAll('button[data-bs-toggle="tab"]').forEach(button => {
            button.addEventListener('click', function() {
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
            });
        });
        
        // Clean up when modal is closed
        document.getElementById('receipt-upload-modal').addEventListener('hidden.bs.modal', function() {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                stream = null;
            }
        });
    }
    
    // Function to set up the Create Mock Receipt button
    function setupMockReceiptButton() {
        const createMockBtn = document.getElementById('create-mock-receipt');
        if (createMockBtn) {
            createMockBtn.onclick = function() {
                if (typeof createMockReceipt === 'function') {
                    createMockReceipt();
                    
                    // Close the modal after creating the mock receipt
                    const modal = bootstrap.Modal.getInstance(document.getElementById('receipt-upload-modal'));
                    if (modal) {
                        modal.hide();
                    }
                } else {
                    console.error('createMockReceipt function not found');
                    alert('Error: Mock receipt function not available');
                }
            };
        }
    }
    
    // Helper function to save receipt and update financial stats
    function saveReceiptAndUpdateStats(receipt) {
        // Store in localStorage
        let simulatedReceipts = JSON.parse(localStorage.getItem('simulatedReceipts') || '[]');
        simulatedReceipts.push(receipt);
        localStorage.setItem('simulatedReceipts', JSON.stringify(simulatedReceipts));
        
        console.log('Receipt saved:', receipt);
        
        // Update financial stats
        try {
            // Update global stats with the new receipt amount
            if (typeof globalStats !== 'undefined') {
                const amount = parseFloat(receipt.total_amount);
                
                // Update receipt totals
                globalStats.receiptsTotal = (parseFloat(globalStats.receiptsTotal) || 0) + amount;
                
                // Update expenses
                globalStats.totalExpenses = (parseFloat(globalStats.totalExpenses) || 0) + amount;
                
                // Update balance
                globalStats.netBalance = globalStats.netIncome - globalStats.totalExpenses;
                
                // Save the updated stats
                if (typeof saveFinancialStats === 'function') {
                    saveFinancialStats();
                }
                
                // Update the dashboard
                if (typeof updateDashboardStats === 'function') {
                    updateDashboardStats();
                }
            }
        } catch (error) {
            console.error('Error updating financial stats:', error);
        }
        
        // Reload receipts list if we're on that page
        if (document.getElementById('receipts-section') && 
            document.getElementById('receipts-section').style.display !== 'none') {
            if (typeof loadReceipts === 'function') {
                loadReceipts();
            }
        }
    }
    
    // Helper function to show success message
    function showSuccessMessage(receipt) {
        const uploadResult = document.getElementById('receipt-upload-result');
        if (uploadResult) {
            uploadResult.innerHTML = `
                <div class="alert alert-success">
                    <h5><i class="fas fa-check-circle me-2"></i>Receipt saved successfully!</h5>
                    <p class="mb-1">Merchant: ${receipt.merchant}</p>
                    <p class="mb-1">Date: ${receipt.date}</p>
                    <p class="mb-1">Total: $${parseFloat(receipt.total_amount).toFixed(2)}</p>
                    <p class="mb-0">Category: ${receipt.category}</p>
                </div>`;
            uploadResult.style.display = 'block';
        }
    }
}); 