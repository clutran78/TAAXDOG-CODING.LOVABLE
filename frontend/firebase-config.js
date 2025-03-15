// Firebase configuration
// This is a development/demo configuration
// In production, this would be replaced with your actual Firebase project settings
const firebaseConfig = {
    apiKey: "demo-key-for-development",
    authDomain: "taaxdog-demo.firebaseapp.com",
    projectId: "taaxdog-demo",
    storageBucket: "taaxdog-demo.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890abcdef"
};

// Export the config for use in other files
// This is only needed if using ES modules
// In a script tag scenario, this will be available globally
if (typeof module !== 'undefined') {
    module.exports = { firebaseConfig };
}

// Initialize Firebase
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db }; 