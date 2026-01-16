// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDrjVsHCJvgXCMksEsLawtuiowBes1JJxw",
    authDomain: "invoice-app-v1-112b7.firebaseapp.com",
    projectId: "invoice-app-v1-112b7",
    storageBucket: "invoice-app-v1-112b7.firebasestorage.app",
    messagingSenderId: "1054438789044",
    appId: "1:1054438789044:web:095b1af955c1c1afb46ce1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, query, where, orderBy };
