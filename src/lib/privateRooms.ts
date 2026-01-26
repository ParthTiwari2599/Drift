import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ✅ Create private room
export const createPrivateRoom = async (userA: string, userB: string) => {
  // Check if room already exists
  const q = query(
    collection(db, "private_rooms"),
    where("userA", "in", [userA, userB]),
    where("userB", "in", [userA, userB])
  );
  const snap = await getDocs(q);
  if (!snap.empty) {
    // Room exists, return the id
    return snap.docs[0].id;
  }

  // Create new room
  const ref = await addDoc(collection(db, "private_rooms"), {
    userA,
    userB,
    customName: null, // Custom name for the chat
    createdAt: serverTimestamp(),
  });

  return ref.id; // private room id
};

// ✅ Update private room custom name
export const updatePrivateRoomName = async (roomId: string, customName: string) => {
  const roomRef = doc(db, "private_rooms", roomId);
  await updateDoc(roomRef, {
    customName,
    updatedAt: serverTimestamp(),
  });
};

// ✅ Listen my private rooms
export const listenMyPrivateRooms = (
  userId: string,
  callback: (rooms: any[]) => void
) => {
  const q1 = query(
    collection(db, "private_rooms"),
    where("userA", "==", userId)
  );

  const q2 = query(
    collection(db, "private_rooms"),
    where("userB", "==", userId)
  );

  let roomsA: any[] = [];
  let roomsB: any[] = [];

  const unsub1 = onSnapshot(q1, (snap1) => {
    roomsA = snap1.docs.map(d => ({ id: d.id, ...d.data() }));
    const allRooms = [...roomsA, ...roomsB];
    // Deduplicate by room ID
    const uniqueRooms = allRooms.filter((room, index, self) =>
      index === self.findIndex(r => r.id === room.id)
    );
    callback(uniqueRooms);
  });

  const unsub2 = onSnapshot(q2, (snap2) => {
    roomsB = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
    const allRooms = [...roomsA, ...roomsB];
    // Deduplicate by room ID
    const uniqueRooms = allRooms.filter((room, index, self) =>
      index === self.findIndex(r => r.id === room.id)
    );
    callback(uniqueRooms);
  });

  return () => {
    unsub1();
    unsub2();
  };
};
