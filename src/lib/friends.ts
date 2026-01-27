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
  deleteDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createPrivateRoom } from "./privateRooms";

// Send friend request
export const sendFriendRequest = async (fromUserId: string, toUserId: string) => {
  // Check if request already exists
  const q = query(
    collection(db, "friend_requests"),
    where("from", "==", fromUserId),
    where("to", "==", toUserId)
  );
  const snap = await getDocs(q);
  if (!snap.empty) {
    throw new Error("Friend request already sent");
  }

  // Check reverse
  const q2 = query(
    collection(db, "friend_requests"),
    where("from", "==", toUserId),
    where("to", "==", fromUserId)
  );
  const snap2 = await getDocs(q2);
  if (!snap2.empty) {
    throw new Error("Friend request already exists");
  }

  await addDoc(collection(db, "friend_requests"), {
    from: fromUserId,
    to: toUserId,
    status: "pending",
    createdAt: serverTimestamp(),
  });
};

// Accept friend request
export const acceptFriendRequest = async (requestId: string, userId: string) => {
  const requestRef = doc(db, "friend_requests", requestId);
  const requestSnap = await getDoc(requestRef);
  if (!requestSnap.exists()) throw new Error("Request not found");

  const request = requestSnap.data();
  if (request!.to !== userId) throw new Error("Not authorized");

  // Update status to accepted
  await updateDoc(requestRef, { status: "accepted" });

  // Add to friends list for both users
  const fromUserRef = doc(db, "users", request!.from);
  const toUserRef = doc(db, "users", request!.to);

  // Get current friends
  const fromSnap = await getDoc(fromUserRef);
  const toSnap = await getDoc(toUserRef);

  const fromFriends = fromSnap.data()?.friends || [];
  const toFriends = toSnap.data()?.friends || [];

  if (!fromFriends.includes(request!.to)) fromFriends.push(request!.to);
  if (!toFriends.includes(request!.from)) toFriends.push(request!.from);

  await updateDoc(fromUserRef, { friends: fromFriends });
  await updateDoc(toUserRef, { friends: toFriends });

  // Create private room
  await createPrivateRoom(request!.from, request!.to);
};

// Reject friend request
export const rejectFriendRequest = async (requestId: string, userId: string) => {
  const requestRef = doc(db, "friend_requests", requestId);
  const requestSnap = await getDoc(requestRef);
  if (!requestSnap.exists()) throw new Error("Request not found");

  const request = requestSnap.data();
  if (request!.to !== userId) throw new Error("Not authorized");

  await deleteDoc(requestRef);
};

// Get friends list
export const getFriends = async (userId: string) => {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return [];

  const friends = userSnap.data()!.friends || [];
  return friends;
};

// Listen to friend requests (received)
export const listenFriendRequests = (userId: string, callback: (requests: any[]) => void) => {
  const q = query(
    collection(db, "friend_requests"),
    where("to", "==", userId),
    where("status", "==", "pending")
  );

  return onSnapshot(q, (snap) => {
    const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(requests);
  });
};

// Get user display name
export const getUserDisplayName = async (userId: string) => {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return "Unknown";

  const data = userSnap.data();
  return data!.customDisplayName || "Unknown";
};