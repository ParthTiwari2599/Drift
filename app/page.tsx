"use client";

import { useState, useEffect } from "react";
import { AppModal } from "@/components/AppModal";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { createOrJoinRoom, getUserData, updateUserData, getRoom } from "@/lib/firestore";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  limit,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { listenToRoomPresenceUsers } from "@/lib/presence";
import {
  Hash,
  Plus,
  Users,
  Zap,
  LogOut,
  Lock,
  Globe,
  Shield,
  ArrowRight,
  Activity,
  MessageSquare,
  EyeOff,
  Sparkles,
  Terminal,
  Menu,
  X,
  House,
  MessageCircle,
  Settings,
  User,
} from "lucide-react";
import FriendsList from "@/components/FriendsList";

interface Room {
  id: string;
  topic: string;
  active: boolean;
  createdAt?: any;
  isLocked?: boolean;
  createdBy?: string;
  passwordHash?: string | null;
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
  const [roomUserCounts, setRoomUserCounts] = useState<{
    [roomId: string]: number;
  }>({});
  const [roomListeners, setRoomListeners] = useState<{
    [roomId: string]: () => void;
  }>({});
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [tempDisplayName, setTempDisplayName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("");

  // Modal state for password input / generic prompts
  const [modal, setModal] = useState<{
    open: boolean;
    message: string;
    input: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSubmit: ((value?: any) => void) | undefined;
  }>({
    open: false,
    message: "",
    input: false,
    onSubmit: undefined,
  });

  // Load user data when user changes
  useEffect(() => {
    if (user) {
      setTempDisplayName(user.displayName || "");
      // Load user data from Firestore to get custom avatar
      const loadUserData = async () => {
        try {
          const userData = await getUserData(user.uid);
          if (userData?.customDisplayName) {
            setTempDisplayName(userData.customDisplayName);
          }
          if (userData?.customAvatar) {
            setSelectedAvatar(userData.customAvatar);
          }
        } catch (error) {
          console.error("Error loading user data:", error);
        }
      };
      loadUserData();
    }
  }, [user]);

  const handleSaveSettings = async () => {
    if (!user) return;

    try {
      // Update display name and avatar in Firestore
      await updateUserData(user.uid, {
        customDisplayName: tempDisplayName,
        customAvatar: selectedAvatar,
      });

      setShowSettingsModal(false);
      alert("Settings updated successfully!");
    } catch (error) {
      console.error("Error updating settings:", error);
      alert("Failed to update settings");
    }
  };

  const generateAvatarFromName = (name: string) => {
    // Simple avatar generation based on name
    const colors = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#96CEB4",
      "#FFEAA7",
      "#DDA0DD",
      "#98D8C8",
    ];
    const colorIndex = name.length % colors.length;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      name
    )}&background=${colors[colorIndex].replace("#", "")}&color=fff&size=128`;
  };

  // Logic section (No changes here except cleanup)
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "rooms"),
      where("active", "==", true),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rooms = snapshot.docs
        .map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as Room)
        )
        .sort((a, b) => {
          if (!a.createdAt || !b.createdAt) return 0;
          return b.createdAt.toMillis() - a.createdAt.toMillis();
        });
      setActiveRooms(rooms);
      const newListeners: { [roomId: string]: () => void } = {};
      rooms.forEach((room) => {
        if (!roomListeners[room.id]) {
          const userCountUnsubscribe = listenToRoomPresenceUsers(
            room.id,
            (users) => {
              setRoomUserCounts((prev) => ({
                ...prev,
                [room.id]: users.length,
              }));
            }
          );
          newListeners[room.id] = userCountUnsubscribe;
        } else {
          newListeners[room.id] = roomListeners[room.id];
        }
      });
      setRoomListeners(newListeners);
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const createRoom = async () => {
    if (!user || !roomName.trim()) return;

    try {
      // Validate password if protection is enabled
      if (isPasswordProtected) {
        if (!roomPassword.trim()) {
          setModal({
            open: true,
            message: "Please enter a password for the protected room",
            input: false,
            onSubmit: () => setModal((prev) => ({ ...prev, open: false })),
          });
          return;
        }
        if (roomPassword !== confirmPassword) {
          setModal({
            open: true,
            message: "Passwords do not match",
            input: false,
            onSubmit: () => setModal((prev) => ({ ...prev, open: false })),
          });
          return;
        }
        if (roomPassword.length < 4) {
          setModal({
            open: true,
            message: "Password must be at least 4 characters",
            input: false,
            onSubmit: () => setModal((prev) => ({ ...prev, open: false })),
          });
          return;
        }
      }

      const slug = roomName
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      const room = await createOrJoinRoom(
        slug,
        isPasswordProtected ? roomPassword : undefined,
        user.uid
      );
      router.push(`/room/${room.id}`);
    } catch (error) {
      setModal({
        open: true,
        message: "Failed to create room: " + (error as Error).message,
        input: false,
        onSubmit: () => setModal((prev) => ({ ...prev, open: false })),
      });
    }
  };

  const joinRoom = async (room: Room) => {
    if (!user) {
      setModal({
        open: true,
        message: "Please login first to join rooms",
        input: false,
        onSubmit: () => setModal((prev) => ({ ...prev, open: false })),
      });
      return;
    }
    setIsMobileMenuOpen(false);

    if (room.isLocked) {
      setModal({
        open: true,
        message: "This room is password protected. Enter password:",
        input: true,
        onSubmit: async (password) => {
          if (!password) return;
          try {
            // Fetch the room and check password
            const roomData = await getRoom(room.id) as Room;
            if (!roomData.passwordHash) throw new Error("No password set");
            const bcrypt = await import('bcryptjs');
            const isMatch = await bcrypt.compare(password, roomData.passwordHash);
            if (!isMatch) throw new Error("Invalid password");
            setModal((prev) => ({ ...prev, open: false }));
            router.push(`/room/${room.id}`);
          } catch (error) {
            setModal({
              open: true,
              message: "Invalid password",
              input: false,
              onSubmit: () => setModal((prev) => ({ ...prev, open: false })),
            });
          }
        },
      });
    } else {
      router.push(`/room/${room.id}`);
    }
  };

  // Simple implementation for "Find Room" button using the existing modal
  const findAndOpenRoom = () => {
    if (!user) {
      setModal({
        open: true,
        message: "Please login first to find rooms",
        input: false,
        onSubmit: () => setModal((prev) => ({ ...prev, open: false })),
      });
      return;
    }

    setModal({
      open: true,
      message: "Enter Room ID or slug to join:",
      input: true,
      onSubmit: async (value) => {
        if (!value) return;
        try {
          const foundRoom = await createOrJoinRoom(value, undefined, user.uid);
          setModal((prev) => ({ ...prev, open: false }));
          router.push(`/room/${foundRoom.id}`);
        } catch (error) {
          setModal({
            open: true,
            message: "Unable to find or join room",
            input: false,
            onSubmit: () => setModal((prev) => ({ ...prev, open: false })),
          });
        }
      },
    });
  };

  if (loading)
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-blue-500 font-mono italic text-sm sm:text-base">
        INITIALIZING_DRIFT...
      </div>
    );

  return (
    <>
      <AppModal
        open={modal.open}
        message={modal.message}
        input={modal.input}
        onClose={() => setModal((prev) => ({ ...prev, open: false }))}
        onSubmit={modal.onSubmit}
      />
      <div
        className={`min-h-screen bg-[#050505] text-white selection:bg-blue-500/30 ${
          isMobileMenuOpen ? "overflow-hidden" : ""
        }`}
      >
        {/* Desktop Sidebar */}
        <aside className="hidden sm:flex w-80 bg-black/40 border-r border-white/10 flex-col backdrop-blur-2xl fixed left-0 top-0 h-full z-30">
          <div className="p-8 border-b border-white/10">
            <div className="flex items-center gap-2 mb-6">
              <Zap className="text-blue-500" fill="currentColor" size={20} />
              <span className="text-lg font-black italic tracking-tighter">
                DRIFT.
              </span>
            </div>

            {/* User Status */}
            {user && !user.isAnonymous ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-zinc-900/30 rounded-xl">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <User size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {user.displayName || "Anonymous"}
                    </p>
                    <p className="text-xs text-zinc-500">Connected</p>
                  </div>
                </div>
                <button
                  onClick={signOut}
                  className="w-full flex items-center gap-3 p-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-all"
                >
                  <LogOut size={16} className="text-red-400" />
                  <span className="text-sm font-medium text-red-400">
                    Disconnect
                  </span>
                </button>
              </div>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="w-full flex items-center gap-3 p-4 bg-blue-600 hover:bg-blue-700 rounded-xl transition-all"
              >
                <Shield size={16} />
                <span className="text-sm font-medium">Secure Auth</span>
              </button>
            )}
          </div>

          {/* Navigation Links */}
          <div className="flex-1 p-8 space-y-2">
            <div className="text-xs font-black uppercase tracking-widest text-zinc-600 mb-4">
              Navigation
            </div>

            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="w-full flex items-center gap-3 p-3 hover:bg-zinc-900/50 rounded-xl transition-all text-left"
            >
              <House size={16} className="text-blue-400" />
              <span className="text-sm font-medium">Home</span>
            </button>

            {user && !user.isAnonymous && (
              <>
                <button
                  onClick={() => {
                    document
                      .getElementById("active-rooms")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-zinc-900/50 rounded-xl transition-all text-left"
                >
                  <MessageCircle size={16} className="text-green-400" />
                  <span className="text-sm font-medium">
                    Active Rooms ({activeRooms.length})
                  </span>
                </button>

                <button
                  onClick={() => {
                    document
                      .getElementById("create-room")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-zinc-900/50 rounded-xl transition-all text-left"
                >
                  <Plus size={16} className="text-purple-400" />
                  <span className="text-sm font-medium">Create Room</span>
                </button>
              </>
            )}

            {/* FriendsList removed as requested */}
                {/* FriendsList removed as requested */}

            <div className="pt-4 border-t border-zinc-800/50 mt-8">
              <button
                onClick={() => {
                  setTempDisplayName(user?.displayName || "");
                  setSelectedAvatar("");
                  setShowSettingsModal(true);
                }}
                className="w-full flex items-center gap-3 p-3 hover:bg-zinc-900/50 rounded-xl transition-all text-left"
              >
                <Settings size={16} className="text-zinc-400" />
                <span className="text-sm font-medium">Settings</span>
              </button>
            </div>
          </div>
        </aside>

        <main className="sm:ml-80 min-h-screen">
          {/* --- HERO SECTION --- */}
          <div className="relative border-b border-white/5">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-blue-600/10 blur-[120px] rounded-full opacity-50" />
            </div>

            <nav className="relative z-10 flex justify-between items-center px-4 sm:px-6 py-6 max-w-7xl mx-auto">
              <div className="flex items-center gap-2">
                <Zap className="text-blue-500" fill="currentColor" />
                <span className="text-xl sm:text-2xl font-black italic tracking-tighter">
                  DRIFT.
                </span>
              </div>

              {/* Desktop Navigation */}
              <div className="hidden sm:flex items-center gap-4">
                {user && !user.isAnonymous ? (
                  <button
                    onClick={signOut}
                    className="text-[10px] font-black uppercase tracking-widest border border-white/10 px-6 py-2 rounded-full hover:bg-red-500/10 transition-all"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={signInWithGoogle}
                    className="bg-white text-black text-[10px] font-black uppercase tracking-widest px-6 py-2 rounded-full"
                  >
                    Secure Auth
                  </button>
                )}
              </div>

              {/* Mobile Hamburger Menu */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="sm:hidden p-2 hover:bg-zinc-900/50 rounded-lg transition-all"
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </nav>

            {/* Mobile Sidebar */}
            <div
              className={`fixed inset-0 z-50 sm:hidden ${
                isMobileMenuOpen ? "block" : "hidden"
              }`}
            >
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setIsMobileMenuOpen(false)}
              />

              {/* Sidebar */}
              <div
                className={`absolute right-0 top-0 h-full w-80 bg-[#050505] border-l border-white/10 transform transition-transform duration-300 ease-in-out ${
                  isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
                }`}
              >
                <div className="flex flex-col h-full p-6">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2">
                      <Zap
                        className="text-blue-500"
                        fill="currentColor"
                        size={20}
                      />
                      <span className="text-lg font-black italic tracking-tighter">
                        DRIFT.
                      </span>
                    </div>
                    <button
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="p-2 hover:bg-zinc-900/50 rounded-lg transition-all"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* User Status */}
                  <div className="mb-8">
                    {user && !user.isAnonymous ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-zinc-900/30 rounded-xl">
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                            <User size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">
                              {user.displayName || "Anonymous"}
                            </p>
                            <p className="text-xs text-zinc-500">Connected</p>
                          </div>
                        </div>
                        <button
                          onClick={signOut}
                          className="w-full flex items-center gap-3 p-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-all"
                        >
                          <LogOut size={16} className="text-red-400" />
                          <span className="text-sm font-medium text-red-400">
                            Disconnect
                          </span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={signInWithGoogle}
                        className="w-full flex items-center gap-3 p-4 bg-blue-600 hover:bg-blue-700 rounded-xl transition-all"
                      >
                        <Shield size={16} />
                        <span className="text-sm font-medium">Secure Auth</span>
                      </button>
                    )}
                  </div>

                  {/* Navigation Links */}
                  <div className="flex-1 space-y-2">
                    <div className="text-xs font-black uppercase tracking-widest text-zinc-600 mb-4">
                      Navigation
                    </div>

                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-zinc-900/50 rounded-xl transition-all text-left"
                    >
                      <House size={16} className="text-blue-400" />
                      <span className="text-sm font-medium">Home</span>
                    </button>

                    {user && !user.isAnonymous && (
                      <>
                        <button
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            // Scroll to active rooms section
                            document
                              .getElementById("active-rooms")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }}
                          className="w-full flex items-center gap-3 p-3 hover:bg-zinc-900/50 rounded-xl transition-all text-left"
                        >
                          <MessageCircle
                            size={16}
                            className="text-green-400"
                          />
                          <span className="text-sm font-medium">
                            Active Rooms ({activeRooms.length})
                          </span>
                        </button>

                        <button
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            // Scroll to room creation form
                            document
                              .getElementById("create-room")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }}
                          className="w-full flex items-center gap-3 p-3 hover:bg-zinc-900/50 rounded-xl transition-all text-left"
                        >
                          <Plus size={16} className="text-purple-400" />
                          <span className="text-sm font-medium">
                            Create Room
                          </span>
                        </button>
                      </>
                    )}

                    {user && <FriendsList />}

                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        setShowSettingsModal(true);
                      }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-zinc-900/50 rounded-xl transition-all text-left"
                    >
                      <Settings size={16} className="text-zinc-400" />
                      <span className="text-sm font-medium">Settings</span>
                    </button>
                  </div>

                  {/* Footer */}
                  <div className="border-t border-white/10 pt-6 space-y-3">
                    <div className="text-center space-y-2">
                      <div className="text-[8px] font-black uppercase tracking-[0.4em] text-zinc-700">
                        DEVELOPED BY
                      </div>
                      <div className="text-sm font-bold text-blue-400">
                        Parth Tiwari
                      </div>
                      <div className="text-[7px] text-zinc-500 font-medium">
                        GitHub: @parthtiwari2599
                      </div>
                      <div className="text-[7px] text-zinc-500 font-medium">
                        parthtiwari2599@gmail.com
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-20 pb-16 sm:pb-32 grid lg:grid-cols-2 gap-10 sm:gap-20 items-center">
              <div className="space-y-6 sm:space-y-8">
                <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tighter italic leading-[0.8]">
                  VANISH <br /> <span className="text-blue-500">INTO</span>{" "}
                  <br /> DATA.
                </h1>
                <p className="text-zinc-500 text-lg sm:text-xl max-w-md font-medium">
                  DRIFT is an ephemeral communication layer where messages
                  don't last, but impact does.
                </p>
                {(!user || user.isAnonymous) && (
                  <button
                    onClick={signInWithGoogle}
                    className="flex items-center gap-3 sm:gap-4 bg-blue-600 px-6 sm:px-8 py-3 sm:py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-105 transition-all"
                  >
                    Start Drifting <ArrowRight size={20} />
                  </button>
                )}
              </div>

              {user && !user.isAnonymous && (
                <div
                  id="create-room"
                  className="bg-zinc-900/30 border border-white/5 p-6 sm:p-8 md:p-12 rounded-[2rem] sm:rounded-[3rem] backdrop-blur-xl shadow-2xl w-full max-w-lg mx-auto lg:mx-0"
                >
                  <h2 className="text-lg sm:text-xl font-black uppercase tracking-widest mb-6 sm:mb-8 flex items-center gap-3">
                    <Terminal size={20} className="text-blue-500" /> New Signal
                  </h2>
                  <div className="space-y-4 sm:space-y-6">
                    <input
                      type="text"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="Room Name..."
                      className="w-full bg-black border border-white/5 rounded-2xl px-4 sm:px-6 py-3 sm:py-4 outline-none focus:border-blue-500 transition-all font-bold text-sm sm:text-base"
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
                        <span className="text-xs sm:text-sm text-zinc-400 font-medium">
                          Make room password protected
                        </span>
                      </label>
                    </div>

                    {/* Password Fields */}
                    {showPasswordFields && (
                      <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-2xl">
                        <div>
                          <input
                            type="password"
                            value={roomPassword}
                            onChange={(e) => setRoomPassword(e.target.value)}
                            placeholder="Enter password (min 4 characters)"
                            className="w-full bg-black border border-zinc-700 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-medium text-sm sm:text-base"
                          />
                        </div>
                        <div>
                          <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm password"
                            className="w-full bg-black border border-zinc-700 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-medium text-sm sm:text-base"
                          />
                        </div>
                        <div className="text-xs text-zinc-500 font-medium">
                          Password will be required for all users to join this
                          room
                        </div>
                      </div>
                    )}

                    <button
                      onClick={createRoom}
                      className="w-full bg-white text-black py-4 sm:py-5 rounded-2xl font-black uppercase tracking-widest text-xs sm:text-sm hover:bg-blue-600 hover:text-white transition-all"
                    >
                      Establish Connection
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* --- LIVE NETWORK SECTION --- */}
          {user && !user.isAnonymous && (
            <section
              id="active-rooms"
              className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-32"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 sm:mb-12 gap-4 sm:gap-6">
                <div className="space-y-2">
                  <span className="text-blue-500 font-black uppercase tracking-[0.3em] text-[10px]">
                    Network Monitor
                  </span>
                  <h2 className="text-3xl sm:text-4xl font-black italic tracking-tighter">
                    ACTIVE UPLINKS
                  </h2>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-zinc-500 max-w-xs text-sm font-medium">
                    Real-time signals currently broadcasting on the DRIFT
                    protocol.
                  </p>
                  <button
                    onClick={findAndOpenRoom}
                    className="px-3 py-2 bg-zinc-900/40 border border-white/5 rounded-lg text-xs font-black hover:bg-blue-600 hover:text-white transition-all"
                  >
                    Find Room
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {activeRooms.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => joinRoom(room)}
                    className="group bg-zinc-900/20 border border-white/5 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] cursor-pointer hover:border-blue-500/50 transition-all"
                  >
                    <div className="flex items-center gap-3 mb-4 sm:mb-6">
                      <Hash
                        className="text-zinc-800 group-hover:text-blue-500 transition-colors"
                        size={32}
                      />
                      {room.isLocked && <Lock className="text-yellow-500" size={20} />}
                    </div>
                    <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight mb-2 flex items-center gap-2">
                      {room.topic}
                      {room.isLocked && (
                        <Lock className="text-yellow-500" size={14} />
                      )}
                    </h3>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                        {roomUserCounts[room.id] || 0} Nodes
                      </span>
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
          )}

          {/* --- "WHAT IS DRIFT" SECTION (THE STORY) --- */}
          <section className="bg-white/5 py-16 sm:py-32 border-y border-white/5">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-10 sm:gap-20 items-center">
              <div className="relative aspect-square bg-zinc-900 rounded-[3rem] sm:rounded-[4rem] overflow-hidden border border-white/10 group order-2 md:order-1">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20 opacity-50" />
                <div className="absolute inset-0 flex items-center justify-center p-8 sm:p-12">
                  <div className="space-y-3 sm:space-y-4 font-mono text-[9px] sm:text-[10px] text-blue-400 opacity-40 group-hover:opacity-100 transition-opacity">
                    <p>{">"} INITIALIZING SECURE_LAYER...</p>
                    <p>{">"} ENCRYPTING END_TO_END...</p>
                    <p>{">"} DELETING METADATA...</p>
                    <p>{">"} STATUS: ANONYMOUS</p>
                  </div>
                </div>
              </div>
              <div className="space-y-6 sm:space-y-8 order-1 md:order-2">
                <h2 className="text-4xl sm:text-5xl font-black italic tracking-tighter">
                  BUILT FOR <br /> SILENCE.
                </h2>
                <div className="space-y-4 sm:space-y-6 text-zinc-400 leading-relaxed">
                  <p>
                    DRIFT is not just another chat app. It's a response to the
                    era of surveillance. We believe your conversations should
                    belong to the air, not to a server.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 pt-6 sm:pt-8">
                    <div className="space-y-2">
                      <Shield className="text-blue-500" size={24} />
                      <h4 className="font-black text-xs uppercase tracking-widest text-white">
                        No Persistence
                      </h4>
                      <p className="text-[10px]">
                        Data exists only while the room is active.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Sparkles className="text-purple-500" size={24} />
                      <h4 className="font-black text-xs uppercase tracking-widest text-white">
                        Identity Fluid
                      </h4>
                      <p className="text-[10px]">
                        Change your presence as you move through nodes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Settings Modal */}
            {showSettingsModal && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                {/* Backdrop */}
                <div
                  className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                  onClick={() => setShowSettingsModal(false)}
                />

                {/* Modal */}
                <div className="relative bg-[#050505] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-black text-white">Settings</h3>
                    <button
                      onClick={() => setShowSettingsModal(false)}
                      className="p-2 hover:bg-zinc-900/50 rounded-lg transition-all"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* Display Name */}
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={tempDisplayName}
                        onChange={(e) => setTempDisplayName(e.target.value)}
                        className="w-full bg-zinc-900/50 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                        placeholder="Enter your display name"
                        maxLength={30}
                      />
                    </div>

                    {/* Avatar Selection */}
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-3">
                        Choose Avatar
                      </label>
                      <div className="grid grid-cols-4 gap-3">
                        {[
                          "👤",
                          "🎭",
                          "🤖",
                          "👨‍💻",
                          "👩‍💻",
                          "🦊",
                          "🐺",
                          "🐱",
                          "🦁",
                          "🐼",
                          "🐨",
                          "🦄",
                          "🐉",
                          "🌟",
                          "⚡",
                          "🔥",
                        ].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => setSelectedAvatar(emoji)}
                            className={`aspect-square rounded-xl border-2 text-2xl flex items-center justify-center transition-all ${
                              selectedAvatar === emoji
                                ? "border-blue-500 bg-blue-500/20"
                                : "border-zinc-700 hover:border-zinc-500"
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-zinc-500 mt-2">
                        Selected: {selectedAvatar || "None"}
                      </p>
                    </div>

                    {/* Preview */}
                    <div className="border-t border-zinc-800 pt-4">
                      <p className="text-sm font-medium text-zinc-400 mb-3">
                        Preview
                      </p>
                      <div className="flex items-center gap-3 p-3 bg-zinc-900/30 rounded-xl">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-lg">
                          {selectedAvatar || "👤"}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {tempDisplayName || "Anonymous"}
                          </p>
                          <p className="text-xs text-zinc-500">
                            Your new profile
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={() => setShowSettingsModal(false)}
                        className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveSettings}
                        className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all font-medium"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* --- HOW IT WORKS GRID --- */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-32 space-y-12 sm:space-y-20">
            <div className="text-center space-y-3 sm:space-y-4">
              <h2 className="text-4xl sm:text-6xl font-black italic tracking-tighter">
                PROTOCOL PHASES
              </h2>
              <p className="text-zinc-500 uppercase tracking-[0.3em] text-[10px] font-bold">
                Follow the sequence to begin communication
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {[
                {
                  step: "01",
                  title: "Authenticate",
                  desc: "Initialize your node with Google Auth for secure handshakes.",
                },
                {
                  step: "02",
                  title: "Initialize",
                  desc: "Create a unique frequency or join an existing active signal.",
                },
                {
                  step: "03",
                  title: "Interact",
                  desc: "Exchange real-time data packets with other connected nodes.",
                },
                {
                  step: "04",
                  title: "Vanish",
                  desc: "Disconnect to purge all session data from the local cache.",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="p-6 sm:p-10 border border-white/5 rounded-2xl sm:rounded-3xl space-y-4 sm:space-y-6 hover:bg-zinc-900/40 transition-all"
                >
                  <span className="text-3xl sm:text-4xl font-black text-blue-500 opacity-20">
                    {item.step}
                  </span>
                  <h3 className="text-lg sm:text-xl font-black italic tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed font-medium">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* --- FOOTER --- */}
          <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20 border-t border-white/5 flex flex-col gap-8 sm:gap-12">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-6 sm:gap-8">
              <div className="flex items-center gap-2 opacity-50">
                <Zap size={14} fill="white" />
                <span className="font-black italic tracking-tighter text-lg sm:text-xl">
                  DRIFT. v2.0
                </span>
              </div>

              {/* Contact Information */}
              <div className="text-center space-y-2 order-3 sm:order-2">
                <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.4em] text-zinc-700">
                  DEVELOPED BY
                </div>
                <div className="text-sm sm:text-base font-bold text-blue-400">
                  Parth Tiwari
                </div>
                <div className="text-[8px] sm:text-[9px] text-zinc-500 font-medium">
                  GitHub: @parthtiwari2599
                </div>
                <div className="text-[8px] sm:text-[9px] text-zinc-500 font-medium">
                  Email: parthtiwari2599@gmail.com
                </div>
                <div className="text-[7px] sm:text-[8px] text-zinc-600 font-black uppercase tracking-widest mt-2">
                  Suggestions & Contributions Welcome
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-zinc-500 order-2 sm:order-3">
                <span>Terminal</span>
                <span>Security</span>
                <span>GitHub</span>
              </div>
            </div>

            {/* Mobile-friendly copyright */}
            <div className="text-center">
              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.4em] text-zinc-700">
                © 2026 ZERO_LOG_SYSTEMS_LLC
              </p>
            </div>
          </footer>
        </main>
      </div>
    </>
  );
}
