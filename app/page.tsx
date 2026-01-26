"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { createOrJoinRoom } from "@/lib/firestore";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { listenToRoomPresenceUsers } from "@/lib/presence";
import { Hash, Plus, Users, Zap, LogOut, User, Lock } from "lucide-react";

interface Room {
  id: string;
  topic: string;
  active: boolean;
  createdAt?: any;
  isLocked?: boolean;
  createdBy?: string;
}

export default function Home() {
  const router = useRouter();
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const [roomName, setRoomName] = useState("");
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [roomPassword, setRoomPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [activeRooms, setActiveRooms] = useState<Room[]>([]);
  const [roomUserCounts, setRoomUserCounts] = useState<{[roomId: string]: number}>({});
  const [roomListeners, setRoomListeners] = useState<{[roomId: string]: () => void}>({});

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "rooms"),
      where("active", "==", true),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rooms = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Room)).sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      });
      setActiveRooms(rooms);

      // Set up user count listeners for each room
      const newListeners: {[roomId: string]: () => void} = {};
      
      rooms.forEach(room => {
        if (!roomListeners[room.id]) {
          const userCountUnsubscribe = listenToRoomPresenceUsers(room.id, (users) => {
            setRoomUserCounts(prev => ({
              ...prev,
              [room.id]: users.length
            }));
          });
          newListeners[room.id] = userCountUnsubscribe;
        } else {
          newListeners[room.id] = roomListeners[room.id];
        }
      });

      // Clean up old listeners for rooms that no longer exist
      Object.keys(roomListeners).forEach(roomId => {
        if (!rooms.find(room => room.id === roomId)) {
          roomListeners[roomId]();
        }
      });

      setRoomListeners(newListeners);
    });

    return () => {
      unsubscribe();
      // Clean up all room listeners
      Object.values(roomListeners).forEach(unsubscribe => unsubscribe());
    };
  }, [user]);

  const createRoom = async () => {
    if (!user || !roomName.trim()) return;

    // Validate password if protection is enabled
    if (isPasswordProtected) {
      if (!roomPassword.trim()) {
        alert("Please enter a password for the protected room");
        return;
      }
      if (roomPassword !== confirmPassword) {
        alert("Passwords do not match");
        return;
      }
      if (roomPassword.length < 4) {
        alert("Password must be at least 4 characters long");
        return;
      }
    }

    const slug = roomName.trim().replace(/\s+/g, '-').toLowerCase();
    try {
      const room = await createOrJoinRoom(slug, isPasswordProtected ? roomPassword : undefined, user.uid);
      router.push(`/room/${room.id}`);
    } catch (error) {
      alert("Failed to create room: " + (error as Error).message);
    }
  };

  const joinRoom = async (room: Room) => {
    if (room.isLocked) {
      const password = prompt("This room is password protected. Enter password:");
      if (!password) return;

      try {
        const verifiedRoom = await createOrJoinRoom(room.topic, password);
        router.push(`/room/${verifiedRoom.id}`);
      } catch (error) {
        alert("Invalid password");
        return;
      }
    } else {
      router.push(`/room/${room.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-zinc-800 border-t-white rounded-full animate-spin"></div>
        <p className="mt-4 text-zinc-500 font-medium tracking-widest animate-pulse">DRIFTING...</p>
      </div>
    );
  }

  return (
    <main className="relative min-h-screen bg-[#050505] text-zinc-200 overflow-hidden font-sans selection:bg-white/20">

      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse transition-all duration-1000"></div>
      </div>

      {/* Navigation / Auth Section */}
      <nav className="relative z-10 flex justify-between items-center p-6 md:px-12">
        <div className="text-xl font-black tracking-tighter italic">DRIFT.</div>

        <div>
          {user ? (
            <div className="flex items-center gap-4 bg-zinc-900/50 border border-white/5 p-1.5 pl-4 rounded-full backdrop-blur-md">
              <span className="text-xs font-medium text-zinc-400">
                {user.displayName || "Explorer"}
              </span>
              <button
                onClick={signOut}
                className="p-2 bg-zinc-800 hover:bg-red-950/30 hover:text-red-400 rounded-full transition-all duration-300"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="px-6 py-2 bg-white text-black text-xs font-bold rounded-full hover:bg-zinc-200 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            >
              Sign In with Google
            </button>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 flex flex-col items-center justify-center pt-12 pb-8 px-4 text-center">
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-4 bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">
          Dynamic Lobby
        </h1>
        <p className="text-zinc-500 text-sm md:text-base max-w-lg leading-relaxed">
          Create or join a room. Connect in real-time.
          <span className="block mt-1 italic opacity-80 font-serif">No logs. No judgment. Just you and the moment.</span>
        </p>
      </section>

      {user ? (
        <div className="relative z-10 max-w-4xl mx-auto px-6 pb-20">
          {/* Room Creation */}
          <div className="mb-8">
            <div className="flex flex-col gap-4">
              <div className="flex gap-4 items-center">
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Enter Room Name"
                  className="flex-1 px-4 py-3 bg-zinc-900/50 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                />
                <button
                  onClick={createRoom}
                  className="px-6 py-3 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 transition-all active:scale-95 flex items-center gap-2"
                >
                  <Plus size={20} />
                  Create Room
                </button>
              </div>

              {/* Password Protection Toggle */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPasswordProtected}
                    onChange={(e) => {
                      setIsPasswordProtected(e.target.checked);
                      setShowPasswordFields(e.target.checked);
                      if (!e.target.checked) {
                        setRoomPassword("");
                        setConfirmPassword("");
                      }
                    }}
                    className="w-4 h-4 text-blue-600 bg-zinc-800 border-zinc-600 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="text-sm text-zinc-400">Make room password protected</span>
                </label>
              </div>

              {/* Password Fields */}
              {showPasswordFields && (
                <div className="space-y-3 p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-lg">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Room Password</label>
                    <input
                      type="password"
                      value={roomPassword}
                      onChange={(e) => setRoomPassword(e.target.value)}
                      placeholder="Enter password (min 4 characters)"
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Confirm Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="text-xs text-zinc-500">
                    Password will be required for all users to join this room
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Active Rooms List */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Zap size={24} />
              Active Rooms
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeRooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => joinRoom(room)}
                  className="group relative flex flex-col items-start p-6 rounded-2xl border border-white/5 bg-zinc-900/40 hover:border-white/20 hover:bg-zinc-800/60 transition-all duration-500 overflow-hidden"
                >
                  <div className="mb-4 p-3 rounded-xl bg-zinc-800/50 group-hover:scale-110 transition-transform duration-500 border border-zinc-700 flex items-center gap-2">
                    <Hash size={20} />
                    {room.isLocked && <Lock size={14} className="text-yellow-500" />}
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                    {room.topic}
                    {room.isLocked && <Lock size={12} className="text-yellow-500" />}
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    <div className={`w-2 h-2 rounded-full ${roomUserCounts[room.id] > 0 ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`}></div>
                    <p className="text-xs text-zinc-500">
                      {roomUserCounts[room.id] || 0} active {roomUserCounts[room.id] === 1 ? 'user' : 'users'}
                    </p>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {room.isLocked ? "Enter password to join" : "Join Room →"}
                  </p>
                  <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-white/5 blur-3xl rounded-full group-hover:bg-white/10 transition-colors"></div>
                </button>
              ))}
            </div>
            {activeRooms.length === 0 && (
              <p className="text-zinc-500 text-center mt-8">No active rooms yet. Create one to get started!</p>
            )}
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex flex-col items-center justify-center py-20">
          <p className="text-zinc-500 mb-8">Sign in to access the Dynamic Lobby</p>
        </div>
      )}

      {/* Footer Info */}
      <footer className="relative z-10 mt-16 text-center pb-8">
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] uppercase tracking-[0.2em] font-bold transition-all
          ${user ? "border-emerald-500/20 text-emerald-500 bg-emerald-500/5" : "border-zinc-800 text-zinc-500 bg-zinc-900/30"}`}>
          {user ? "● System Active: Secure Connection" : "○ System Idle: Sign in to drift"}
        </div>
      </footer>
    </main>
  );
}