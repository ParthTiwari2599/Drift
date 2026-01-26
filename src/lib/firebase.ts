import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, enableNetwork, disableNetwork } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Connection status tracking
let isOnline = true;
let connectionCheckInterval: NodeJS.Timeout | null = null;

export const getConnectionStatus = () => isOnline;

export const setConnectionStatus = (status: boolean) => {
  isOnline = status;
};

// Monitor connection status
export const monitorConnection = (callback?: (status: boolean) => void) => {
  if (typeof window !== 'undefined') {
    const handleOnline = () => {
      setConnectionStatus(true);
      // Try to re-enable network when coming back online
      enableNetwork(db).catch(console.warn);
      callback?.(true);
    };

    const handleOffline = () => {
      setConnectionStatus(false);
      // Disable network when offline
      disableNetwork(db).catch(console.warn);
      callback?.(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Return cleanup function
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }

  return () => {}; // No-op cleanup for server-side
};

// Initialize connection monitoring
if (typeof window !== 'undefined') {
  monitorConnection();
  setConnectionStatus(navigator.onLine);
}

// Avatar utility functions
export const generateRandomAvatar = (seed?: string) => {
  const avatarSeed = seed || Math.random().toString(36).substring(7);
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd93d,ff6b6b,4ecdc4,45b7d1,f7b731,fd79a8,f8b500`;
};

export const generateAvatarFromName = (name: string) => {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd93d,ff6b6b,4ecdc4,45b7d1,f7b731,fd79a8,f8b500&fontSize=40`;
};
