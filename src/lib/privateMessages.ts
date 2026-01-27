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
  type: "text" | "image" | "emoji" | "sticker" | "voice" = "text",
  deleteMode: "never" | "seen" | "24h" | "2h" = "2h",
  replyTo?: any
) => {
  const now = Date.now();
  let expireAt: Timestamp | null = null;

  if (deleteMode === "2h") {
    expireAt = Timestamp.fromMillis(now + 2 * 60 * 60 * 1000);
  } else if (deleteMode === "24h") {
    expireAt = Timestamp.fromMillis(now + 24 * 60 * 60 * 1000);
  }

  const messageData: any = {
    roomId,
    text,
    userId,
    type,
    deleteMode,
    seenBy: [],
    expireAt,
    createdAt: serverTimestamp(),
  };

  if (replyTo) {
    messageData.replyTo = replyTo;
  }

  await addDoc(collection(db, "messages"), messageData);
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