/**
 * Firebase singleton bootstrap. Reads VITE_FIREBASE_* values from .env at
 * build time. The Web SDK config is PUBLIC by design (it identifies the
 * project, it does not authenticate access); security comes from Firebase
 * Security Rules + the backend's ID-token verifier.
 */

import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider,
  GithubAuthProvider,
  getAuth,
  type Auth,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const env = (key: string): string => {
  const value = import.meta.env[key as keyof ImportMetaEnv];
  return typeof value === "string" ? value : "";
};

const firebaseConfig = {
  apiKey: env("VITE_FIREBASE_API_KEY"),
  authDomain: env("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: env("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: env("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: env("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: env("VITE_FIREBASE_APP_ID"),
  measurementId: env("VITE_FIREBASE_MEASUREMENT_ID"),
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId,
);

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

export const firebaseApp = (): FirebaseApp => {
  if (!isFirebaseConfigured) {
    throw new Error(
      "Firebase is not configured. Populate VITE_FIREBASE_* in frontend/.env.",
    );
  }
  if (!_app) _app = initializeApp(firebaseConfig);
  return _app;
};

export const firebaseAuth = (): Auth => {
  if (!_auth) _auth = getAuth(firebaseApp());
  return _auth;
};

export const firebaseDb = (): Firestore => {
  if (!_db) _db = getFirestore(firebaseApp());
  return _db;
};

export const googleProvider = () => {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: "select_account" });
  return p;
};

export const githubProvider = () => {
  const p = new GithubAuthProvider();
  p.addScope("read:user");
  p.addScope("user:email");
  return p;
};
