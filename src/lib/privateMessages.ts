import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// 🔥 Send private message
export const sendPrivateMessage = async (
  roomId: string,
  text: string,
  userId: string,
  type: "text" | "image" | "emoji" | "sticker" = "text",
  deleteMode: "never" | "seen" | "24h" = "never",
  replyTo?: any
) => {
  const now = Date.now();
  let expireAt: Timestamp | null = null;

  if (deleteMode === "24h") {
    expireAt = Timestamp.fromMillis(now + 24 * 60 * 60 * 1000);
  }

  await addDoc(collection(db, "messages"), {
    roomId,
    text,
    userId,
    type,
    deleteMode,
    seenBy: [],
    expireAt,
    replyTo,
    createdAt: serverTimestamp(),
  });
};

// 🔥 Listen private messages
export const listenPrivateMessages = (
  roomId: string,
  callback: (msgs: any[]) => void
) => {
  const q = query(
    collection(db, "messages"),
    where("roomId", "==", roomId),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(q, (snap) => {
    const now = Date.now();
    const msgs = snap.docs
      .map(d => ({
        id: d.id,
        ...d.data(),
      } as any))
      .filter((msg) => !msg.expireAt || msg.expireAt.toMillis() > now); // filter out expired

    callback(msgs);
  });
};