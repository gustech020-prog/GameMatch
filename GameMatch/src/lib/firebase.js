import { initializeApp } from "firebase/app";
import { browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC52phx8lQ9SqbQVlLa6g8O_qjYIGwe090",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "game-match-3f1d9.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "game-match-3f1d9",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "game-match-3f1d9.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "262372762734",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:262372762734:web:92084f8d8bd1288f16727f",
};

const firebaseApp = initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

let persistencePromise;

export function ensureAuthPersistence() {
  if (!persistencePromise) {
    persistencePromise = setPersistence(auth, browserLocalPersistence).catch(() => undefined);
  }

  return persistencePromise;
}
