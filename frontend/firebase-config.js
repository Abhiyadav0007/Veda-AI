// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDq4vZ-S-Q-SYVSN8JdIGpJF5WpKQnEiUQ",
  authDomain: "veda-ai-ff47b.firebaseapp.com",
  projectId: "veda-ai-ff47b",
  storageBucket: "veda-ai-ff47b.firebasestorage.app",
  messagingSenderId: "253758172760",
  appId: "1:253758172760:web:f811597fb5b99134b8642d"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore database
const db = firebase.firestore();

console.log("Firebase connected successfully!");