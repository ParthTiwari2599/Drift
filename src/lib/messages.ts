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

// 🔥 Send message
export const sendMessageToRoom = async (
  topic: string,
  text: string,
  userId: string,
  type: "text" | "image" | "emoji" | "sticker" = "text",
  deleteMode?: "never" | "seen" | "24h" | "36h"
) => {
  if (!topic || !text || !userId) {
    throw new Error("sendMessageToRoom: Missing params");
  }

  const now = Date.now();
  const expireAt = deleteMode === "36h" ? Timestamp.fromMillis(now + 36 * 60 * 60 * 1000) : null;

  await addDoc(collection(db, "messages"), {
    roomId: topic, // topic = roomId
    text,
    userId,
    type,
    deleteMode: deleteMode || "36h", // group default 36h
    expireAt,
    createdAt: serverTimestamp(),
  });
};

// 🔥 Listen messages
export const listenToRoomMessages = (
  topic: string,
  callback: (messages: any[]) => void
) => {
  const q = query(
    collection(db, "messages"),
    where("roomId", "==", topic),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(q, (snap) => {
    const now = Date.now();
    const msgs = snap.docs
      .map((d) => ({
        id: d.id,
        ...d.data(),
      } as any))
      .filter((msg) => !msg.expireAt || msg.expireAt.toMillis() > now); // filter out expired

    callback(msgs);
  });
};
