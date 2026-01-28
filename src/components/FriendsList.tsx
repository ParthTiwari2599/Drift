"use client";

import { useState, useEffect } from "react";
import { AppModal } from "@/components/AppModal";
import { useAuth } from "@/hooks/useAuth";
import { getUserDisplayName, sendFriendRequest, listenFriendRequests, acceptFriendRequest, rejectFriendRequest } from "@/lib/friends";
import { createPrivateRoom } from "@/lib/privateRooms";
import { useRouter } from "next/navigation";
import { MessageCircle, UserPlus, Check, X } from "lucide-react";
import { collection, query, where, getDocs, doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Friend {
  id: string;
  name: string;
}

interface FriendRequest {
  id: string;
  from: string;
  fromName: string;
}

export default function FriendsList() {
  const { user } = useAuth();
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  // Modal state
  const [modal, setModal] = useState<{
    open: boolean;
    title?: string;
    message?: string;
    input?: boolean;
    placeholder?: string;
    onSubmit?: (value?: string) => void;
  }>({ open: false });

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    // Real-time listener for friends array
    const userRef = doc(db, "users", user.uid);
    const unsubUser = onSnapshot(userRef, async (snap) => {
      const data = snap.data();
      const friendIds = data?.friends || [];
      // DEBUG: print friendIds
      if (typeof window !== 'undefined') {
        console.log('FRIENDS ARRAY:', friendIds);
      }
      const friendData: Friend[] = [];
      for (const id of friendIds) {
        const name = await getUserDisplayName(id);
        friendData.push({ id, name });
      }
      setFriends(friendData);
      setLoading(false);
    });

    // Listen to friend requests
    const unsubReq = listenFriendRequests(user.uid, async (reqs) => {
      const reqData: FriendRequest[] = [];
      for (const req of reqs) {
        const name = await getUserDisplayName(req.from);
        reqData.push({ id: req.id, from: req.from, fromName: name });
      }
      setRequests(reqData);
    });

    return () => {
      unsubUser();
      unsubReq();
    };
  }, [user]);

  const openPrivateChat = async (friendId: string) => {
    if (!user) return;
    try {
      const roomId = await createPrivateRoom(user.uid, friendId);
      router.push(`/private/${roomId}`);
    } catch (error) {
      console.error("Error opening private chat:", error);
    }
  };

  const addFriend = () => {
    setModal({
      open: true,
      title: "Add Friend",
      message: "Enter your friend's display name:",
      input: true,
      placeholder: "Display name",
      onSubmit: async (name) => {
        if (!name || !user) return;
        try {
          const usersSnap = await getDocs(query(collection(db, "users"), where("customDisplayName", "==", name)));
          if (usersSnap.empty) {
            setModal({
              open: true,
              title: "User Not Found",
              message: "No user found with that display name.",
              onSubmit: () => setModal({ open: false })
            });
            return;
          }
          const friendId = usersSnap.docs[0].id;
          await sendFriendRequest(user.uid, friendId);
          setModal({
            open: true,
            title: "Success",
            message: "Friend request sent!",
            onSubmit: () => setModal({ open: false })
          });
        } catch (error: any) {
          setModal({
            open: true,
            title: "Error",
            message: "Error: " + error.message,
            onSubmit: () => setModal({ open: false })
          });
        }
      }
    });
  };

  const acceptRequest = async (requestId: string) => {
    try {
      await acceptFriendRequest(requestId, user!.uid);
      setRequests(requests.filter(r => r.id !== requestId));
    } catch (error: any) {
      setModal({
        open: true,
        title: "Error",
        message: "Error: " + error.message,
        onSubmit: () => setModal({ open: false })
      });
    }
  };

  const rejectRequest = async (requestId: string) => {
    try {
      await rejectFriendRequest(requestId, user!.uid);
      setRequests(requests.filter(r => r.id !== requestId));
    } catch (error: any) {
      setModal({
        open: true,
        title: "Error",
        message: "Error: " + error.message,
        onSubmit: () => setModal({ open: false })
      });
    }
  };

  if (!user) return null;

  return (
    <>
      <AppModal
        open={modal.open}
        title={modal.title}
        message={modal.message}
        input={modal.input}
        placeholder={modal.placeholder}
        onClose={() => setModal({ open: false })}
        onSubmit={modal.onSubmit}
      />
      <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-black uppercase tracking-widest text-zinc-600">Friends</div>
        <button
          onClick={addFriend}
          className="p-1 hover:bg-zinc-900/50 rounded"
          title="Add Friend"
        >
          <UserPlus size={14} className="text-zinc-400" />
        </button>
      </div>

      {/* Friend Requests */}
      {requests.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-zinc-500">Requests:</div>
          {requests.map((req) => (
            <div key={req.id} className="flex items-center justify-between p-2 bg-zinc-900/30 rounded">
              <span className="text-sm truncate">{req.fromName}</span>
              <div className="flex gap-1">
                <button onClick={() => acceptRequest(req.id)} className="p-1 hover:bg-green-500/20 rounded">
                  <Check size={12} className="text-green-400" />
                </button>
                <button onClick={() => rejectRequest(req.id)} className="p-1 hover:bg-red-500/20 rounded">
                  <X size={12} className="text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="max-h-40 overflow-y-auto space-y-1">
        {loading ? (
          <div className="text-xs text-zinc-500">Loading...</div>
        ) : (
          friends.length === 0 ? (
            <div className="text-xs text-zinc-500">You have no friends yet. Add some!</div>
          ) : (
            friends.map((friend) => (
              <button
                key={friend.id}
                onClick={() => openPrivateChat(friend.id)}
                className="w-full flex items-center gap-3 p-2 hover:bg-zinc-900/50 rounded-lg transition-all text-left"
              >
                <MessageCircle size={14} className="text-blue-400" />
                <span className="text-sm font-medium truncate">{friend.name}</span>
              </button>
            ))
          )
        )}
      </div>
    </div>
    </>
  );
}