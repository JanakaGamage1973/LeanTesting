// Firebase Configuration for LeanTesting
// IMPORTANT: Replace these values with your Firebase project config
// Get these from Firebase Console > Project Settings > Your Apps > Web App

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyCp_lFa8GigV8eH8yzyy53U7rYzrdhtdCw",
    authDomain: "leantesting-99151.firebaseapp.com",
    projectId: "leantesting-99151",
    storageBucket: "leantesting-99151.firebasestorage.app",
    messagingSenderId: "112433453586",
    appId: "1:112433453586:web:47eba9bc38f98ad66096cb"
};

export const EMAIL_DOMAIN = '@leantesting-99151.firebaseapp.com';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
