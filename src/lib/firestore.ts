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

export const createOrJoinRoom = async (topic: string, password?: string, creatorId?: string) => {
  return retryFirebaseOperation(async () => {
    const roomsRef = collection(db, "rooms");

    // Check if active room exists for this topic
    const q = query(
      roomsRef,
      where("topic", "==", topic)
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      // Join existing room
      const roomDoc = snapshot.docs[0];
      const roomData = roomDoc.data();

      // Check if room is password protected
      if (roomData.isLocked && password) {
        if (password !== roomData.password) {
          throw new Error("Invalid password");
        }
      } else if (roomData.isLocked && !password) {
        throw new Error("Password required");
      }

      return { id: roomDoc.id, ...roomDoc.data() };
    }

    // Create new room
    const roomData: any = {
      topic,
      active: true,
      createdAt: serverTimestamp(),
      createdBy: creatorId,
    };

    if (password) {
      roomData.isLocked = true;
      roomData.password = password; // Note: In production, this should be hashed
    } else {
      roomData.isLocked = false;
    }

    const newRoom = await addDoc(roomsRef, roomData);

    return { id: newRoom.id, ...roomData };
  });
};

export const deleteRoom = async (roomId: string, userId: string) => {
  return retryFirebaseOperation(async () => {
    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
      throw new Error("Room not found");
    }

    const roomData = roomSnap.data();

    // Only allow creator to delete the room
    if (roomData.createdBy !== userId) {
      throw new Error("Only room creator can delete this room");
    }

    // Delete the room document
    await deleteDoc(roomRef);

    return true;
  });
};

export const verifyRoomPassword = async (roomId: string, password: string) => {
  return retryFirebaseOperation(async () => {
    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
      throw new Error("Room not found");
    }

    const roomData = roomSnap.data();

    if (!roomData.isLocked) {
      return true; // Room is not locked
    }

    return password === roomData.password;
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

export const getUserData = async (uid: string) => {
  return retryFirebaseOperation(async () => {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      return userSnap.data();
    }
    return null;
  });
};

export const updateUserDisplayName = async (uid: string, displayName: string) => {
  return retryFirebaseOperation(async () => {
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, {
      customDisplayName: displayName,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return true;
  });
};

export const updateUserData = async (uid: string, data: { customDisplayName?: string; customAvatar?: string }) => {
  return retryFirebaseOperation(async () => {
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, {
      ...data,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return true;
  });
};
