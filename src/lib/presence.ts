// 📁 src/lib/presence.ts

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { db, getConnectionStatus } from "@/lib/firebase";

const ACTIVE_WINDOW = 30000; // 30 seconds TTL window

// Utility function for retrying Firebase operations
const retryFirebaseOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check if we're online before attempting
      if (!getConnectionStatus() && attempt === 1) {
        throw new Error("No internet connection. Please check your network and try again.");
      }

      return await operation();
    } catch (error: any) {
      lastError = error;

      // Don't retry for certain errors
      if (error.code === 'permission-denied' ||
          error.code === 'not-found' ||
          error.message?.includes('permission')) {
        throw error;
      }

      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        break;
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }

  throw lastError!;
};

/* ============================= */
/* JOIN PRESENCE */
/* ============================= */
export const joinRoomPresence = async (topic: string, userId: string) => {
  return retryFirebaseOperation(async () => {
    const ref = doc(db, "presence", `${topic}_${userId}`);

    await setDoc(
      ref,
      {
        roomId: topic,
        userId,
        joinedAt: serverTimestamp(),
        lastActive: serverTimestamp(),
      },
      { merge: true }
    );
  });
};

/* ============================= */
/* HEARTBEAT */
/* ============================= */
export const heartbeatPresence = async (topic: string, userId: string) => {
  return retryFirebaseOperation(async () => {
    const ref = doc(db, "presence", `${topic}_${userId}`);

    await updateDoc(ref, {
      lastActive: serverTimestamp(),
    }).catch(() => joinRoomPresence(topic, userId)); // doc missing ho to auto-join
  });
};

/* ============================= */
/* LEAVE PRESENCE */
/* ============================= */
export const leaveRoomPresence = async (topic: string, userId: string) => {
  return retryFirebaseOperation(async () => {
    const ref = doc(db, "presence", `${topic}_${userId}`);
    await deleteDoc(ref);
  });
};

/* ============================= */
/* ACTIVE COUNT LISTENER */
/* ============================= */
export const listenToRoomPresence = (
  topic: string,
  callback: (count: number) => void,
  onError?: (error: Error) => void
) => {
  const q = query(collection(db, "presence"), where("roomId", "==", topic));

  return onSnapshot(q,
    (snapshot) => {
      const now = Date.now();

      const activeUsers = snapshot.docs.filter((d) => {
        const data: any = d.data();
        if (!data.lastActive) return false;

        const last = data.lastActive.toMillis
          ? data.lastActive.toMillis()
          : now;
        return now - last < ACTIVE_WINDOW;
      });

      callback(activeUsers.length);
    },
    (error) => {
      console.error("Error listening to room presence:", error);
      if (onError) {
        onError(error as Error);
      }
    }
  );
};

/* ============================= */
/* ACTIVE USERS LIST */
/* ============================= */
export const listenToRoomPresenceUsers = (
  topic: string,
  callback: (users: any[]) => void,
  onError?: (error: Error) => void
) => {
  const q = query(collection(db, "presence"), where("roomId", "==", topic));

  return onSnapshot(q,
    (snap) => {
      const now = Date.now();

      const users = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as any))
        .filter((u) => {
          if (!u.lastActive) return true;
          const last = u.lastActive.toMillis ? u.lastActive.toMillis() : now;
          return now - last < ACTIVE_WINDOW;
        });

      callback(users);
    },
    (error) => {
      console.error("Error listening to room presence users:", error);
      if (onError) {
        onError(error as Error);
      }
    }
  );
};
