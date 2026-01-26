import { db } from "@/lib/firebase";
import { 
    collection, 
    addDoc, 
    serverTimestamp, 
    query, 
    where, 
    onSnapshot, 
    updateDoc, 
    doc, 
    getDoc 
} from "firebase/firestore";
import { createPrivateRoom } from "@/lib/privateRooms";

// 1. Connection Request bhejna
export const sendConnectRequest = async (fromUid: string, toUid: string, roomTopic: string) => {
    await addDoc(collection(db, "connection_requests"), {
        fromUser: fromUid,
        toUser: toUid,
        status: "pending",
        roomTopic: roomTopic,
        createdAt: serverTimestamp(),
    });
};

// 2. Sent Requests listen karna
export const listenSentRequests = (userId: string, callback: (sentToIds: string[]) => void) => {
    const q = query(
        collection(db, "connection_requests"), 
        where("fromUser", "==", userId), 
        where("status", "==", "pending")
    );
    return onSnapshot(q, (snap) => {
        const sentToIds = snap.docs.map((d) => d.data().toUser);
        callback(sentToIds);
    });
};

// 3. Incoming Requests listen karna
export const listenIncomingRequests = (userId: string, callback: (reqs: any[]) => void) => {
    const q = query(
        collection(db, "connection_requests"), 
        where("toUser", "==", userId), 
        where("status", "==", "pending")
    );
    return onSnapshot(q, (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        callback(data);
    });
};

// 4. Accepted Requests listen karna
export const listenAcceptedRequests = (userId: string, callback: (reqs: any[]) => void) => {
    const q = query(
        collection(db, "connection_requests"), 
        where("fromUser", "==", userId), 
        where("status", "==", "accepted")
    );
    return onSnapshot(q, (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        callback(data);
    });
};

// 5. Actions
export const acceptRequest = async (requestId: string) => {
    const ref = doc(db, "connection_requests", requestId);
    const snap = await getDoc(ref);
    const data = snap.data();
    if (!data) return;

    const roomId = await createPrivateRoom(data.fromUser, data.toUser);
    await updateDoc(ref, { 
        status: "accepted", 
        privateRoomId: roomId 
    });
    return roomId;
};

export const rejectRequest = async (requestId: string) => {
    const ref = doc(db, "connection_requests", requestId);
    await updateDoc(ref, { status: "rejected" });
};