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
import { db } from "@/lib/firebase";

const ACTIVE_WINDOW = 30000; // 30 seconds TTL window

/* ============================= */
/* JOIN PRESENCE */
/* ============================= */
export const joinRoomPresence = async (topic: string, userId: string) => {
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
};

/* ============================= */
/* HEARTBEAT */
/* ============================= */
export const heartbeatPresence = async (topic: string, userId: string) => {
  const ref = doc(db, "presence", `${topic}_${userId}`);

  await updateDoc(ref, {
    lastActive: serverTimestamp(),
  }).catch(() => joinRoomPresence(topic, userId)); // doc missing ho to auto-join
};

/* ============================= */
/* LEAVE PRESENCE */
/* ============================= */
export const leaveRoomPresence = async (topic: string, userId: string) => {
  const ref = doc(db, "presence", `${topic}_${userId}`);
  await deleteDoc(ref);
};

/* ============================= */
/* ACTIVE COUNT LISTENER */
/* ============================= */
export const listenToRoomPresence = (
  topic: string,
  callback: (count: number) => void
) => {
  const q = query(collection(db, "presence"), where("roomId", "==", topic));

  return onSnapshot(q, (snapshot) => {
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
  });
};

/* ============================= */
/* ACTIVE USERS LIST */
/* ============================= */
export const listenToRoomPresenceUsers = (
  topic: string,
  callback: (users: any[]) => void
) => {
  const q = query(collection(db, "presence"), where("roomId", "==", topic));

  return onSnapshot(q, (snap) => {
    const now = Date.now();

    const users = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as any))
      .filter((u) => {
        if (!u.lastActive) return true;
        const last = u.lastActive.toMillis ? u.lastActive.toMillis() : now;
        return now - last < ACTIVE_WINDOW;
      });

    callback(users);
  });
};
