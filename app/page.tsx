"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { createOrJoinRoom } from "@/lib/firestore";
import { db } from "@/lib/firebase";
import { collection, query, where, limit, onSnapshot } from "firebase/firestore";
import { listenToRoomPresenceUsers } from "@/lib/presence";
import { Hash, Plus, Users, Zap, LogOut, Lock, Globe, Shield, ArrowRight, Activity, MessageSquare, EyeOff, Sparkles, Terminal } from "lucide-react";

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
  const [roomUserCounts, setRoomUserCounts] = useState<{ [roomId: string]: number }>({});
  const [roomListeners, setRoomListeners] = useState<{ [roomId: string]: () => void }>({});

  // Logic section (No changes here)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "rooms"), where("active", "==", true), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rooms = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Room)).sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      });
      setActiveRooms(rooms);
      const newListeners: { [roomId: string]: () => void } = {};
      rooms.forEach(room => {
        if (!roomListeners[room.id]) {
          const userCountUnsubscribe = listenToRoomPresenceUsers(room.id, (users) => {
            setRoomUserCounts(prev => ({ ...prev, [room.id]: users.length }));
          });
          newListeners[room.id] = userCountUnsubscribe;
        } else {
          newListeners[room.id] = roomListeners[room.id];
        }
      });
      setRoomListeners(newListeners);
    });
    return () => unsubscribe();
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

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-blue-500 font-mono italic">INITIALIZING_DRIFT...</div>;

  return (
    <main className="min-h-screen bg-[#050505] text-white selection:bg-blue-500/30">
      
      {/* --- HERO SECTION --- */}
      <div className="relative border-b border-white/5">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-blue-600/10 blur-[120px] rounded-full opacity-50" />
        </div>

        <nav className="relative z-10 flex justify-between items-center px-6 py-8 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <Zap className="text-blue-500" fill="currentColor" />
            <span className="text-2xl font-black italic tracking-tighter">DRIFT.</span>
          </div>
          {user ? (
            <button onClick={signOut} className="text-[10px] font-black uppercase tracking-widest border border-white/10 px-6 py-2 rounded-full hover:bg-red-500/10 transition-all">Disconnect</button>
          ) : (
            <button onClick={signInWithGoogle} className="bg-white text-black text-[10px] font-black uppercase tracking-widest px-6 py-2 rounded-full">Secure Auth</button>
          )}
        </nav>

        <section className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32 grid lg:grid-cols-2 gap-20 items-center">
          <div className="space-y-8">
            <h1 className="text-7xl md:text-9xl font-black tracking-tighter italic leading-[0.8]">
              VANISH <br /> <span className="text-blue-500">INTO</span> <br /> DATA.
            </h1>
            <p className="text-zinc-500 text-xl max-w-md font-medium">
              DRIFT is an ephemeral communication layer where messages don't last, but impact does. 
            </p>
            {!user && (
                <button onClick={signInWithGoogle} className="flex items-center gap-4 bg-blue-600 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-105 transition-all">
                    Start Drifting <ArrowRight size={20}/>
                </button>
            )}
          </div>

          {user && (
            <div className="bg-zinc-900/30 border border-white/5 p-8 md:p-12 rounded-[3rem] backdrop-blur-xl shadow-2xl">
               <h2 className="text-xl font-black uppercase tracking-widest mb-8 flex items-center gap-3">
                 <Terminal size={20} className="text-blue-500" /> New Signal
               </h2>
               <div className="space-y-6">
                  <input 
                    type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Room Name..."
                    className="w-full bg-black border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-blue-500 transition-all font-bold"
                  />

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
                      <span className="text-sm text-zinc-400 font-medium">Make room password protected</span>
                    </label>
                  </div>

                  {/* Password Fields */}
                  {showPasswordFields && (
                    <div className="space-y-4 p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-2xl">
                      <div>
                        <input
                          type="password"
                          value={roomPassword}
                          onChange={(e) => setRoomPassword(e.target.value)}
                          placeholder="Enter password (min 4 characters)"
                          className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-medium"
                        />
                      </div>
                      <div>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm password"
                          className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-medium"
                        />
                      </div>
                      <div className="text-xs text-zinc-500 font-medium">
                        Password will be required for all users to join this room
                      </div>
                    </div>
                  )}

                  <button onClick={createRoom} className="w-full bg-white text-black py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-600 hover:text-white transition-all">
                    Establish Connection
                  </button>
               </div>
            </div>
          )}
        </section>
      </div>

      {/* --- LIVE NETWORK SECTION --- */}
      <section className="max-w-7xl mx-auto px-6 py-32">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
            <div className="space-y-2">
                <span className="text-blue-500 font-black uppercase tracking-[0.3em] text-[10px]">Network Monitor</span>
                <h2 className="text-4xl font-black italic tracking-tighter">ACTIVE UPLINKS</h2>
            </div>
            <p className="text-zinc-500 max-w-xs text-sm font-medium">Real-time signals currently broadcasting on the DRIFT protocol.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
            {activeRooms.map(room => (
                <div key={room.id} onClick={() => joinRoom(room)} className="group bg-zinc-900/20 border border-white/5 p-8 rounded-[2.5rem] cursor-pointer hover:border-blue-500/50 transition-all">
                    <div className="flex items-center gap-3 mb-6">
                        <Hash className="text-zinc-800 group-hover:text-blue-500 transition-colors" size={32} />
                        {room.isLocked && <Lock className="text-yellow-500" size={20} />}
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight mb-2 flex items-center gap-2">
                        {room.topic}
                        {room.isLocked && <Lock className="text-yellow-500" size={14} />}
                    </h3>
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{roomUserCounts[room.id] || 0} Nodes</span>
                    </div>
                    {room.isLocked && (
                        <p className="text-xs text-yellow-500 mt-2 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                            Password required
                        </p>
                    )}
                </div>
            ))}
        </div>
      </section>

      {/* --- "WHAT IS DRIFT" SECTION (THE STORY) --- */}
      <section className="bg-white/5 py-32 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-20 items-center">
            <div className="relative aspect-square bg-zinc-900 rounded-[4rem] overflow-hidden border border-white/10 group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20 opacity-50" />
                <div className="absolute inset-0 flex items-center justify-center p-12">
                    <div className="space-y-4 font-mono text-[10px] text-blue-400 opacity-40 group-hover:opacity-100 transition-opacity">
                        <p>{">"} INITIALIZING SECURE_LAYER...</p>
                        <p>{">"} ENCRYPTING END_TO_END...</p>
                        <p>{">"} DELETING METADATA...</p>
                        <p>{">"} STATUS: ANONYMOUS</p>
                    </div>
                </div>
            </div>
            <div className="space-y-8">
                <h2 className="text-5xl font-black italic tracking-tighter">BUILT FOR <br/> SILENCE.</h2>
                <div className="space-y-6 text-zinc-400 leading-relaxed">
                    <p>DRIFT is not just another chat app. It's a response to the era of surveillance. We believe your conversations should belong to the air, not to a server.</p>
                    <div className="grid grid-cols-2 gap-8 pt-8">
                        <div className="space-y-2">
                            <Shield className="text-blue-500" size={24} />
                            <h4 className="font-black text-xs uppercase tracking-widest text-white">No Persistence</h4>
                            <p className="text-[10px]">Data exists only while the room is active.</p>
                        </div>
                        <div className="space-y-2">
                            <Sparkles className="text-purple-500" size={24} />
                            <h4 className="font-black text-xs uppercase tracking-widest text-white">Identity Fluid</h4>
                            <p className="text-[10px]">Change your presence as you move through nodes.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* --- HOW IT WORKS GRID --- */}
      <section className="max-w-7xl mx-auto px-6 py-32 space-y-20">
         <div className="text-center space-y-4">
            <h2 className="text-6xl font-black italic tracking-tighter">PROTOCOL PHASES</h2>
            <p className="text-zinc-500 uppercase tracking-[0.3em] text-[10px] font-bold">Follow the sequence to begin communication</p>
         </div>

         <div className="grid md:grid-cols-4 gap-4">
            {[
                { step: "01", title: "Authenticate", desc: "Initialize your node with Google Auth for secure handshakes." },
                { step: "02", title: "Initialize", desc: "Create a unique frequency or join an existing active signal." },
                { step: "03", title: "Interact", desc: "Exchange real-time data packets with other connected nodes." },
                { step: "04", title: "Vanish", desc: "Disconnect to purge all session data from the local cache." }
            ].map((item, i) => (
                <div key={i} className="p-10 border border-white/5 rounded-3xl space-y-6 hover:bg-zinc-900/40 transition-all">
                    <span className="text-4xl font-black text-blue-500 opacity-20">{item.step}</span>
                    <h3 className="text-xl font-black italic tracking-tight">{item.title}</h3>
                    <p className="text-xs text-zinc-500 leading-relaxed font-medium">{item.desc}</p>
                </div>
            ))}
         </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="max-w-7xl mx-auto px-6 py-20 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8">
         <div className="flex items-center gap-2 opacity-50">
            <Zap size={14} fill="white" />
            <span className="font-black italic tracking-tighter">DRIFT. v2.0</span>
         </div>
         
         {/* Contact Information */}
         <div className="text-center space-y-2">
            <div className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-700">DEVELOPED BY</div>
            <div className="text-sm font-bold text-blue-400">Parth Tiwari</div>
            <div className="text-[9px] text-zinc-500 font-medium">GitHub: @parthtiwari2599</div>
            <div className="text-[9px] text-zinc-500 font-medium">Email: parthtiwari2599@gmail.com</div>
            <div className="text-[8px] text-zinc-600 font-black uppercase tracking-widest mt-2">Suggestions & Contributions Welcome</div>
         </div>
         
         <div className="flex gap-6 text-[10px] font-black uppercase tracking-widest text-zinc-500">
            <span>Terminal</span>
            <span>Security</span>
            <span>GitHub</span>
        </div>
      </footer>

    </main>
  );
}