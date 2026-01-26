"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import {
  signInAnonymously,
  onAuthStateChanged,
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const result = await signInAnonymously(auth);
        setUser(result.user);
      } catch (error) {
        console.error("Anonymous auth error:", error);
      } finally {
        setLoading(false);
        setHasInitialized(true);
      }
    };

    // short timeout to start auth if no user yet
    const timeout = setTimeout(() => {
      if (!hasInitialized) {
        initializeAuth();
      }
    }, 500);

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setLoading(false);
        setHasInitialized(true);
      } else if (hasInitialized) {
        // user signed out after init
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, [hasInitialized]);

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      setUser(result.user);
      return result.user;
    } catch (error) {
      console.error("Google sign-in error:", error);
      throw error;
    }
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Sign out error:", error);
      throw error;
    }
  };

  return {
    user,
    loading,
    signInWithGoogle,
    signOut: signOutUser,
  };
};
