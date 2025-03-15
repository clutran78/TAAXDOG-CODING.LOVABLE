/**
 * Authentication module for TAAXDOG
 * 
 * This module provides functions for user authentication using Firebase Auth,
 * including registration, login, logout, password reset, and profile management.
 */

import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  onAuthStateChanged
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase-config.js";

/**
 * Register a new user with email and password
 * 
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @param {string} name - User's full name
 * @param {string} phone - User's phone number (optional)
 * @returns {Promise<Object>} - User data object
 */
export const registerUser = async (email, password, name, phone = null) => {
  try {
    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Update user profile with name
    await updateProfile(user, {
      displayName: name
    });
    
    // Create user document in Firestore
    const userData = {
      user_id: user.uid,
      email: email,
      name: name,
      phone: phone,
      created_at: serverTimestamp()
    };
    
    await setDoc(doc(db, "users", user.uid), userData);
    
    return { success: true, user: userData };
  } catch (error) {
    console.error("Error registering user:", error);
    return { 
      success: false, 
      error: error.message || "Failed to register user" 
    };
  }
};

/**
 * Log in an existing user with email and password
 * 
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @returns {Promise<Object>} - User data object
 */
export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Get user data from Firestore
    const userDoc = await getDoc(doc(db, "users", user.uid));
    
    if (userDoc.exists()) {
      return { success: true, user: userDoc.data() };
    } else {
      // If user exists in Auth but not in Firestore, create the document
      const userData = {
        user_id: user.uid,
        email: user.email,
        name: user.displayName || "",
        phone: null,
        created_at: serverTimestamp()
      };
      
      await setDoc(doc(db, "users", user.uid), userData);
      return { success: true, user: userData };
    }
  } catch (error) {
    console.error("Error logging in:", error);
    return { 
      success: false, 
      error: error.message || "Failed to log in" 
    };
  }
};

/**
 * Log out the current user
 * 
 * @returns {Promise<Object>} - Success status
 */
export const logoutUser = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error("Error logging out:", error);
    return { 
      success: false, 
      error: error.message || "Failed to log out" 
    };
  }
};

/**
 * Send a password reset email to the user
 * 
 * @param {string} email - User's email address
 * @returns {Promise<Object>} - Success status
 */
export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return { 
      success: false, 
      error: error.message || "Failed to send password reset email" 
    };
  }
};

/**
 * Update user profile information
 * 
 * @param {string} name - User's new name
 * @param {string} phone - User's new phone number
 * @returns {Promise<Object>} - Success status
 */
export const updateUserProfile = async (name, phone = null) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("No user is currently logged in");
    }
    
    // Update profile in Firebase Auth
    await updateProfile(user, {
      displayName: name
    });
    
    // Update user document in Firestore
    await updateDoc(doc(db, "users", user.uid), {
      name: name,
      phone: phone
    });
    
    return { success: true };
  } catch (error) {
    console.error("Error updating profile:", error);
    return { 
      success: false, 
      error: error.message || "Failed to update profile" 
    };
  }
};

/**
 * Update user email address
 * 
 * @param {string} newEmail - User's new email address
 * @param {string} password - User's current password for verification
 * @returns {Promise<Object>} - Success status
 */
export const updateUserEmail = async (newEmail, password) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("No user is currently logged in");
    }
    
    // Re-authenticate user before changing email
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
    
    // Update email in Firebase Auth
    await updateEmail(user, newEmail);
    
    // Update email in Firestore
    await updateDoc(doc(db, "users", user.uid), {
      email: newEmail
    });
    
    return { success: true };
  } catch (error) {
    console.error("Error updating email:", error);
    return { 
      success: false, 
      error: error.message || "Failed to update email" 
    };
  }
};

/**
 * Update user password
 * 
 * @param {string} currentPassword - User's current password
 * @param {string} newPassword - User's new password
 * @returns {Promise<Object>} - Success status
 */
export const updateUserPassword = async (currentPassword, newPassword) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("No user is currently logged in");
    }
    
    // Re-authenticate user before changing password
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    
    // Update password in Firebase Auth
    await updatePassword(user, newPassword);
    
    return { success: true };
  } catch (error) {
    console.error("Error updating password:", error);
    return { 
      success: false, 
      error: error.message || "Failed to update password" 
    };
  }
};

/**
 * Get the current authenticated user
 * 
 * @returns {Promise<Object>} - User data object
 */
export const getCurrentUser = async () => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: "No user is currently logged in" };
    }
    
    // Get user data from Firestore
    const userDoc = await getDoc(doc(db, "users", user.uid));
    
    if (userDoc.exists()) {
      return { success: true, user: userDoc.data() };
    } else {
      return { success: false, error: "User document not found in database" };
    }
  } catch (error) {
    console.error("Error getting current user:", error);
    return { 
      success: false, 
      error: error.message || "Failed to get current user" 
    };
  }
};

/**
 * Set up an auth state change listener
 * 
 * @param {Function} callback - Function to call when auth state changes
 * @returns {Function} - Unsubscribe function
 */
export const onAuthStateChange = (callback) => {
  return onAuthStateChanged(auth, callback);
}; 