// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-storage.js';

const firebaseConfig = {
    apiKey: "AIzaSyBMkF_8ATiMTWsMwiyifUoAQgQ3kImQifk",
    authDomain: "two-moons-studio-app.firebaseapp.com",
    databaseURL: "https://two-moons-studio-app-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "two-moons-studio-app",
    storageBucket: "two-moons-studio-app.firebasestorage.app",
    messagingSenderId: "541880038976",
    appId: "1:541880038976:web:50e631b354d0a89dd7d1a5"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const storage = getStorage(app);

export { database, storage };
