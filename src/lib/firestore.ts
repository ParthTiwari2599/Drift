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
} from "firebase/firestore";

export const createOrJoinRoom = async (topic: string) => {
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
    return { id: roomDoc.id, ...roomDoc.data() };
  }

  // Create new room
  const newRoom = await addDoc(roomsRef, {
    topic,
    active: true,
    createdAt: serverTimestamp(),
  });

  return { id: newRoom.id, topic, active: true };
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
