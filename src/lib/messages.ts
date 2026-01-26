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
import { db, getConnectionStatus } from "@/lib/firebase";

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

  return retryFirebaseOperation(async () => {
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
  });
};

// 🔥 Listen messages
export const listenToRoomMessages = (
  topic: string,
  callback: (messages: any[]) => void,
  onError?: (error: Error) => void
) => {
  const q = query(
    collection(db, "messages"),
    where("roomId", "==", topic),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(q,
    (snap) => {
      const now = Date.now();
      const msgs = snap.docs
        .map((d) => ({
          id: d.id,
          ...d.data(),
        } as any))
        .filter((msg) => !msg.expireAt || msg.expireAt.toMillis() > now); // filter out expired

      callback(msgs);
    },
    (error) => {
      console.error("Error listening to room messages:", error);
      if (onError) {
        onError(error as Error);
      }
    }
  );
};

// 🔥 Add reaction to message
export const addReactionToMessage = async (
  messageId: string,
  emoji: string,
  userId: string
) => {
  return retryFirebaseOperation(async () => {
    const messageRef = doc(db, "messages", messageId);
    await updateDoc(messageRef, {
      [`reactions.${emoji}`]: arrayUnion(userId)
    });
  });
};

// 🔥 Remove reaction from message
export const removeReactionFromMessage = async (
  messageId: string,
  emoji: string,
  userId: string
) => {
  return retryFirebaseOperation(async () => {
    const messageRef = doc(db, "messages", messageId);
    await updateDoc(messageRef, {
      [`reactions.${emoji}`]: arrayRemove(userId)
    });
  });
};

// 🔥 Cleanup expired messages (call this periodically)
export const cleanupExpiredMessages = async () => {
  return retryFirebaseOperation(async () => {
    const now = Timestamp.now();
    const q = query(
      collection(db, "messages"),
      where("expireAt", "<=", now)
    );

    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));

    await Promise.all(deletePromises);
    console.log(`Cleaned up ${deletePromises.length} expired messages`);
  });
};
