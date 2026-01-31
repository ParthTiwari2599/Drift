"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getUserDisplayName } from "@/lib/friends";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Friend {
  id: string;
  name: string;
}



export default function FriendsList() {
  const { user } = useAuth();
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  // Throttle reads: only fetch display names if friendIds actually change
  const lastFriendIdsRef = useRef<string[]>([]);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const userRef = doc(db, "users", user.uid);
    const unsubUser = onSnapshot(userRef, async (snap) => {
      const data = snap.data();
      let friendIds = data?.friends || [];
      // Auto-repair: If friends array missing, create it
      if (!Array.isArray(friendIds)) {
        friendIds = [];
        // Patch Firestore to add empty friends array
        await updateDoc(userRef, { friends: [] });
      }
      // Only update if friendIds actually changed
      const last = lastFriendIdsRef.current;
      if (friendIds.length === last.length && friendIds.every((id, i) => id === last[i])) {
        setLoading(false);
        return;
      }
      lastFriendIdsRef.current = friendIds;
      // Debounce fetching display names to avoid rapid re-reads
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(async () => {
        const friendData: Friend[] = [];
        for (const id of friendIds) {
          let name = await getUserDisplayName(id);
          if (!name || name === "Unknown") name = id;
          friendData.push({ id, name });
        }
        setFriends(friendData);
        setLoading(false);
      }, 300); // 300ms debounce
    });
    return () => {
      unsubUser();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [user]);

  const openPrivateChat = async (friendId: string) => {
    if (!user) return;
    router.push(`/private/${friendId}`);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-black uppercase tracking-widest text-zinc-600">Friends</div>
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
  );
}