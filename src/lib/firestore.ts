import { db } from "@/lib/firebase";
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

export const createOrJoinRoom = async (topic: string, password?: string, creatorId?: string) => {
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
};

export const deleteRoom = async (roomId: string, userId: string) => {
  try {
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
  } catch (error) {
    console.error("Error deleting room:", error);
    throw error;
  }
};

export const verifyRoomPassword = async (roomId: string, password: string) => {
  try {
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
  } catch (error) {
    console.error("Error verifying room password:", error);
    return false;
  }
};

export const getRoom = async (roomId: string) => {
  const roomRef = doc(db, "rooms", roomId);
  const roomSnap = await getDoc(roomRef);

  if (roomSnap.exists()) {
    return { id: roomSnap.id, ...roomSnap.data() };
  }

  return null;
};

export const getUserData = async (uid: string) => {
    try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            return userSnap.data();
        }
        return null;
    } catch (error) {
        console.error("Error fetching user data:", error);
        return null;
    }
};

export const updateUserDisplayName = async (uid: string, displayName: string) => {
    try {
        const userRef = doc(db, "users", uid);
        await setDoc(userRef, {
            customDisplayName: displayName,
            updatedAt: serverTimestamp(),
        }, { merge: true });
        return true;
    } catch (error) {
        console.error("Error updating user display name:", error);
        return false;
    }
};
