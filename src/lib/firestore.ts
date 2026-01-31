import { db, getConnectionStatus } from "@/lib/firebase";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import bcrypt from "bcryptjs";

/**
 * 🛠 UTILITY: Firebase operation retry logic with connection check
 */
const retryFirebaseOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!getConnectionStatus() && attempt === 1) {
        throw new Error("No internet connection. Please check your network.");
      }
      return await operation();
    } catch (error: any) {
      lastError = error;
      // In errors par retry nahi karna hai
      if (
        error.code === 'permission-denied' ||
        error.code === 'not-found' ||
        error.message?.includes('permission') ||
        error.message === "INVALID_PASSWORD" ||
        error.message === "PASSWORD_REQUIRED"
      ) {
        throw error;
      }

      if (attempt === maxRetries) break;
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  throw lastError!;
};

/* ================= ROOM OPERATIONS ================= */

/**
 * Creates a room or joins an existing one using a slug.
 * Integrated with bcrypt for secure password handling.
 */
export const createOrJoinRoom = async (topic: string, password?: string, userId?: string) => {
  return retryFirebaseOperation(async () => {
    const roomsRef = collection(db, "rooms");
    const slug = topic.trim().replace(/\s+/g, "-").toLowerCase();

    // 🔍 Find room by slug
    const q = query(roomsRef, where("slug", "==", slug));
    const snapshot = await getDocs(q);

    // JOIN EXISTING ROOM
    if (!snapshot.empty) {
      const roomDoc = snapshot.docs[0];
      const roomData = roomDoc.data();

      if (roomData.isLocked) {
        if (!password) throw new Error("PASSWORD_REQUIRED");
        const isMatch = await bcrypt.compare(password, roomData.passwordHash);
        if (!isMatch) throw new Error("INVALID_PASSWORD");
      }

      return { id: roomDoc.id, ...roomData };
    }

    // Only create a new room if NO room exists with this slug
    // (If a room exists but password is wrong, we already returned above)
    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    const roomData = {
      topic,
      slug,
      active: true,
      isLocked: !!password,
      passwordHash: passwordHash,
      createdBy: userId || null,
      createdAt: serverTimestamp(),
    };

    const newRoom = await addDoc(roomsRef, roomData);
    return { id: newRoom.id, ...roomData };
  });
};

/**
 * Specifically finds a private (locked) room.
 */
export const findPrivateRoom = async (roomName: string, password: string) => {
  return retryFirebaseOperation(async () => {
    const roomsRef = collection(db, "rooms");
    const slug = roomName.trim().replace(/\s+/g, "-").toLowerCase();

    const q = query(
      roomsRef,
      where("slug", "==", slug),
      where("isLocked", "==", true)
    );

    const snap = await getDocs(q);
    if (snap.empty) throw new Error("ROOM_NOT_FOUND");

    const roomDoc = snap.docs[0];
    const roomData = roomDoc.data();

    const match = await bcrypt.compare(password, roomData.passwordHash);
    if (!match) throw new Error("INVALID_PASSWORD");

    return { id: roomDoc.id, ...roomData };
  });
};

export const getRoom = async (roomId: string) => {
  return retryFirebaseOperation(async () => {
    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);

    if (roomSnap.exists()) {
      return { id: roomSnap.id, ...roomSnap.data() };
    }
    throw new Error("Room not found");
  });
};

export const deleteRoom = async (roomId: string, userId: string) => {
  return retryFirebaseOperation(async () => {
    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) throw new Error("Room not found");

    const roomData = roomSnap.data();
    if (roomData.createdBy !== userId) {
      throw new Error("Only room creator can delete this room");
    }

    await deleteDoc(roomRef);
    return true;
  });
};

/* ================= USER OPERATIONS ================= */

export const getUserData = async (uid: string) => {
  return retryFirebaseOperation(async () => {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    return userSnap.exists() ? userSnap.data() : null;
  });
};

export const updateUserData = async (uid: string, data: { customDisplayName?: string; customAvatar?: string }) => {
  return retryFirebaseOperation(async () => {
    const userRef = doc(db, "users", uid);
    // Read current data to preserve friends array
    const snap = await getDoc(userRef);
    let existing = {};
    if (snap.exists()) {
      const d = snap.data();
      if (d.friends) existing = { friends: d.friends };
    }
    await setDoc(userRef, {
      ...existing,
      ...data,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return true;
  });
};