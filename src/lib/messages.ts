import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// 🔥 Send message
export const sendMessageToRoom = async (
  topic: string,
  text: string,
  userId: string,
  type: "text" | "image" | "emoji" | "sticker" = "text",
  deleteMode?: "never" | "seen" | "24h" | "2h",
  replyTo?: any
) => {
  if (!topic || !text || !userId) {
    throw new Error("sendMessageToRoom: Missing params");
  }

  const now = Date.now();
  const expireAt = deleteMode === "2h" ? Timestamp.fromMillis(now + 2 * 60 * 60 * 1000) : null;

  await addDoc(collection(db, "messages"), {
    roomId: topic, // topic = roomId
    text,
    userId,
    type,
    deleteMode: deleteMode || "2h", // group default 2h
    expireAt,
    replyTo,
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

// 🔥 Add reaction to message
export const addReactionToMessage = async (
  messageId: string,
  emoji: string,
  userId: string
) => {
  const messageRef = doc(db, "messages", messageId);
  await updateDoc(messageRef, {
    [`reactions.${emoji}`]: arrayUnion(userId)
  });
};

// 🔥 Remove reaction from message
export const removeReactionFromMessage = async (
  messageId: string,
  emoji: string,
  userId: string
) => {
  const messageRef = doc(db, "messages", messageId);
  await updateDoc(messageRef, {
    [`reactions.${emoji}`]: arrayRemove(userId)
  });
};

// 🔥 Cleanup expired messages (call this periodically)
export const cleanupExpiredMessages = async () => {
  try {
    const now = Timestamp.now();
    const q = query(
      collection(db, "messages"),
      where("expireAt", "<=", now)
    );

    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));

    await Promise.all(deletePromises);
    console.log(`Cleaned up ${deletePromises.length} expired messages`);
  } catch (error) {
    console.error("Error cleaning up expired messages:", error);
  }
};
