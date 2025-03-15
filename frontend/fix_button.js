// Simple script to fix the Upload Receipt button
console.log('Running receipt button fix script');

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded - initializing receipt button fix');
    
    // Fix for the upload button
    setTimeout(function() {
        const uploadButton = document.getElementById('upload-receipt-btn');
        const uploadModal = document.getElementById('receipt-upload-modal');
        
        console.log('Upload button found:', !!uploadButton);
        console.log('Upload modal found:', !!uploadModal);
        
        if (uploadButton && uploadModal) {
            // Create a Bootstrap modal instance
            const bootstrapModal = new bootstrap.Modal(uploadModal);
            
            // Add click event listener
            uploadButton.addEventListener('click', function(e) {
                console.log('Upload button clicked!');
                e.preventDefault();
                bootstrapModal.show();
            });
            
            console.log('Event listener attached to upload button');
        }
        
        // Also fix the "Upload Your First Receipt" button if it exists
        const firstReceiptBtn = document.getElementById('upload-first-receipt-btn');
        if (firstReceiptBtn && uploadModal) {
            const bootstrapModal = new bootstrap.Modal(uploadModal);
            firstReceiptBtn.addEventListener('click', function(e) {
                console.log('First receipt button clicked!');
                e.preventDefault();
                bootstrapModal.show();
            });
            console.log('Event listener attached to first receipt button');
        }
    }, 1000); // Adding a slight delay to ensure all DOM elements are properly initialized
}); 