// Firebase configuration
// This is a development/demo configuration
// In production, this would be replaced with your actual Firebase project settings
const firebaseConfig = {
    apiKey: "AIzaSyD8kO6FyYRPcqbbRKRzuv9MRXROcjf8LdU",
    authDomain: "taax-dog.firebaseapp.com",
    projectId: "taax-dog",
    storageBucket: "taax-dog.firebasestorage.app",
    messagingSenderId: "51790399651",
    appId: "1:51790399651:web:d18ca1b3597306cc34d716",
    measurementId: "G-HR04MW6RTE"
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