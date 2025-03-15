// This script will be run in the browser console to fix the issue with the upload receipt button
document.addEventListener('DOMContentLoaded', function() {
    console.log('Adding event listener to upload receipt button');
    
    // Get the upload button and modal elements
    const uploadReceiptBtn = document.getElementById('upload-receipt-btn');
    const uploadFirstReceiptBtn = document.getElementById('upload-first-receipt-btn');
    const receiptUploadModal = new bootstrap.Modal(document.getElementById('receipt-upload-modal'));
    
    // Add event listener to the upload receipt button
    if (uploadReceiptBtn) {
        uploadReceiptBtn.addEventListener('click', function() {
            console.log('Upload receipt button clicked');
            receiptUploadModal.show();
        });
        console.log('Event listener added to upload receipt button');
    } else {
        console.error('Upload receipt button not found');
    }
    
    // Add event listener to the "Upload Your First Receipt" button
    if (uploadFirstReceiptBtn) {
        uploadFirstReceiptBtn.addEventListener('click', function() {
            console.log('Upload first receipt button clicked');
            receiptUploadModal.show();
        });
        console.log('Event listener added to upload first receipt button');
    } else {
        console.log('Upload first receipt button not found (this is normal if you have receipts)');
    }
}); 