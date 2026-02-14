"use client";

import { useState, useEffect } from "react";
import { AppModal } from "@/components/AppModal";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "convex/_generated/api";
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
  createdAt?: number;
  isLocked?: boolean;
  createdBy?: string;
  passwordHash?: string | null;
  activeCount?: number;
}

export default function Home() {
  const githubUrl = "https://github.com/parthtiwari2599";
  const linkedinUrl = "https://www.linkedin.com/in/parthtiwari2599";
  const router = useRouter();
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const [roomName, setRoomName] = useState("");
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [roomPassword, setRoomPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const roomsWithCounts = useQuery(api.rooms.listActiveRoomsWithCounts) || [];
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [tempDisplayName, setTempDisplayName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("");

  const createOrJoinRoom = useMutation(api.rooms.createOrJoinRoom);
  const upsertUser = useMutation(api.users.upsertUser);
  const cleanupExpiredMessages = useMutation(api.messages.cleanupExpiredMessages);
  const userData = useQuery(
    api.users.getUser,
    user ? { userId: user.uid } : "skip"
  );
  const hashPassword = useAction(api.passwordActions.hashPassword);
  const comparePassword = useAction(api.passwordActions.comparePassword);

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
    if (!user) return;
    setTempDisplayName(user.displayName || "");
    if (userData?.customDisplayName) {
      setTempDisplayName(userData.customDisplayName);
    }
    if (userData?.customAvatar) {
      setSelectedAvatar(userData.customAvatar);
    }
  }, [user, userData]);

  // Client-side cleanup for expired group messages (no TTL / no Functions)
  useEffect(() => {
    const runCleanup = async () => {
      try {
        await cleanupExpiredMessages({});
      } catch {
        // ignore cleanup errors on client
      }
    };
    runCleanup();
    const interval = setInterval(runCleanup, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [cleanupExpiredMessages]);

  const handleSaveSettings = async () => {
    if (!user) return;

    try {
      // Update display name and avatar in Convex
      await upsertUser({
        userId: user.uid,
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

  const activeRooms: Room[] = roomsWithCounts as Room[];

  const handleCreateRoom = async () => {
    if (!user || !roomName.trim()) return;

    let passwordHash: string | undefined = undefined;
    if (isPasswordProtected && roomPassword) {
      passwordHash = await hashPassword({ password: roomPassword });
    }

    const room = await createOrJoinRoom({
      topic: roomName.trim(),
      passwordHash,
      userId: user.uid,
    });
    router.push(`/room/${room.id}`);
  };

  const handleJoinRoom = async (room: Room, password: string) => {
    if (!room.passwordHash) throw new Error("Room has no password hash");
    const ok = await comparePassword({ password, hash: room.passwordHash });
    if (!ok) throw new Error("INVALID_PASSWORD");
    if (!user) throw new Error("User not logged in");
    await createOrJoinRoom({
      topic: room.topic,
      passwordHash: room.passwordHash,
      userId: user.uid,
    });
    router.push(`/room/${room.id}`);
  };

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
          const foundRoom = await createOrJoinRoom({
            topic: value,
            userId: user.uid,
          });
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
      <div className="min-h-screen bg-stone-100 flex items-center justify-center text-emerald-600 font-mono italic text-sm sm:text-base">
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
        className={`min-h-screen bg-stone-100 text-stone-900 selection:bg-emerald-500/30 ${
          isMobileMenuOpen ? "overflow-hidden" : ""
        }`}
      >
        {/* Desktop Sidebar */}
        <aside className="hidden sm:flex w-80 bg-white border-r border-stone-200 flex-col backdrop-blur-2xl fixed left-0 top-0 h-full z-30">
          <div className="p-8 border-b border-stone-200">
            <div className="flex items-center gap-2 mb-6">
              <Zap className="text-emerald-600" fill="currentColor" size={20} />
              <span className="text-lg font-black italic tracking-tighter">
                DRIFT.
              </span>
            </div>

            {/* User Status */}
            {user && !user.isAnonymous ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-white">
                    <User size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-stone-900">
                      {user.displayName || "Anonymous"}
                    </p>
                    <p className="text-xs text-stone-500 font-bold uppercase tracking-wider">Connected</p>
                  </div>
                </div>
                <button
                  onClick={signOut}
                  className="w-full flex items-center gap-3 p-3 bg-stone-200/50 hover:bg-stone-200 border border-stone-300 rounded-xl transition-all"
                >
                  <LogOut size={16} className="text-stone-600" />
                  <span className="text-sm font-medium text-stone-600">
                    Disconnect
                  </span>
                </button>
              </div>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="w-full flex items-center gap-3 p-4 bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all text-white shadow-lg shadow-emerald-200"
              >
                <Shield size={16} />
                <span className="text-sm font-medium">Secure Auth</span>
              </button>
            )}
          </div>

          {/* Navigation Links */}
          <div className="flex-1 p-8 space-y-2">
            <div className="text-xs font-black uppercase tracking-widest text-stone-400 mb-4">
              Navigation
            </div>

            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="w-full flex items-center gap-3 p-3 hover:bg-stone-50 rounded-xl transition-all text-left"
            >
              <House size={16} className="text-emerald-500" />
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
                  className="w-full flex items-center gap-3 p-3 hover:bg-stone-50 rounded-xl transition-all text-left"
                >
                  <MessageCircle size={16} className="text-emerald-600" />
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
                  className="w-full flex items-center gap-3 p-3 hover:bg-stone-50 rounded-xl transition-all text-left"
                >
                  <Plus size={16} className="text-emerald-600" />
                  <span className="text-sm font-medium">Create Room</span>
                </button>
              </>
            )}

            <div className="pt-4 border-t border-stone-200 mt-8">
              <button
                onClick={() => {
                  setTempDisplayName(user?.displayName || "");
                  setSelectedAvatar("");
                  setShowSettingsModal(true);
                }}
                className="w-full flex items-center gap-3 p-3 hover:bg-stone-50 rounded-xl transition-all text-left"
              >
                <Settings size={16} className="text-stone-400" />
                <span className="text-sm font-medium">Settings</span>
              </button>
            </div>
          </div>
        </aside>

        <main className="sm:ml-80 min-h-screen">
          {/* --- HERO SECTION --- */}
          <div className="relative border-b border-stone-200">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-emerald-500/5 blur-[120px] rounded-full opacity-50" />
            </div>

            <nav className="relative z-10 flex justify-between items-center px-4 sm:px-6 py-6 max-w-7xl mx-auto">
              <div className="flex items-center gap-2 sm:hidden">
                <Zap className="text-emerald-600" fill="currentColor" />
                <span className="text-xl sm:text-2xl font-black italic tracking-tighter">
                  DRIFT.
                </span>
              </div>

              {/* Desktop Navigation */}
              <div className="hidden sm:flex items-center gap-4">
                {user && !user.isAnonymous ? (
                  <button
                    onClick={signOut}
                    className="text-[10px] font-black uppercase tracking-widest border border-stone-200 px-6 py-2 rounded-full hover:bg-emerald-500/10 transition-all"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={signInWithGoogle}
                    className="bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest px-6 py-2 rounded-full shadow-lg shadow-emerald-200"
                  >
                    Secure Auth
                  </button>
                )}
              </div>

              {/* Mobile Hamburger Menu */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="sm:hidden p-2 hover:bg-white border border-stone-200 rounded-lg transition-all"
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
              <div
                className="absolute inset-0 bg-stone-900/20 backdrop-blur-sm"
                onClick={() => setIsMobileMenuOpen(false)}
              />

              <div
                className={`absolute right-0 top-0 h-full w-80 bg-stone-100 border-l border-stone-200 transform transition-transform duration-300 ease-in-out ${
                  isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
                }`}
              >
                <div className="flex flex-col h-full p-6">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2">
                      <Zap
                        className="text-emerald-600"
                        fill="currentColor"
                        size={20}
                      />
                      <span className="text-lg font-black italic tracking-tighter">
                        DRIFT.
                      </span>
                    </div>
                    <button
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="p-2 hover:bg-white border border-stone-200 rounded-lg transition-all"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="mb-8">
                    {user && !user.isAnonymous ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-white border border-stone-200 rounded-xl">
                          <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-white">
                            <User size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-stone-900">
                              {user.displayName || "Anonymous"}
                            </p>
                            <p className="text-xs text-stone-500 font-bold uppercase tracking-wider">Connected</p>
                          </div>
                        </div>
                        <button
                          onClick={signOut}
                          className="w-full flex items-center gap-3 p-3 bg-stone-200/50 hover:bg-stone-200 border border-stone-300 rounded-xl transition-all"
                        >
                          <LogOut size={16} className="text-stone-600" />
                          <span className="text-sm font-medium text-stone-600">
                            Disconnect
                          </span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={signInWithGoogle}
                        className="w-full flex items-center gap-3 p-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-200 transition-all"
                      >
                        <Shield size={16} />
                        <span className="text-sm font-medium">Secure Auth</span>
                      </button>
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="text-xs font-black uppercase tracking-widest text-stone-400 mb-4">
                      Navigation
                    </div>

                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-white rounded-xl transition-all text-left"
                    >
                      <House size={16} className="text-emerald-500" />
                      <span className="text-sm font-medium text-stone-900">Home</span>
                    </button>

                    {user && !user.isAnonymous && (
                      <>
                        <button
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            document
                              .getElementById("active-rooms")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }}
                          className="w-full flex items-center gap-3 p-3 hover:bg-white rounded-xl transition-all text-left"
                        >
                          <MessageCircle
                            size={16}
                            className="text-emerald-600"
                          />
                          <span className="text-sm font-medium text-stone-900">
                            Active Rooms ({activeRooms.length})
                          </span>
                        </button>

                        <button
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            document
                              .getElementById("create-room")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }}
                          className="w-full flex items-center gap-3 p-3 hover:bg-white rounded-xl transition-all text-left"
                        >
                          <Plus size={16} className="text-emerald-600" />
                          <span className="text-sm font-medium text-stone-900">
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
                      className="w-full flex items-center gap-3 p-3 hover:bg-white rounded-xl transition-all text-left"
                    >
                      <Settings size={16} className="text-stone-400" />
                      <span className="text-sm font-medium text-stone-900">Settings</span>
                    </button>
                  </div>

                  <div className="border-t border-stone-200 pt-6 space-y-3">
                    <div className="text-center space-y-2">
                      <div className="text-[8px] font-black uppercase tracking-[0.4em] text-stone-400">
                        DEVELOPED BY
                      </div>
                      <div className="text-sm font-bold text-emerald-600">
                        Parth Tiwari
                      </div>
                      <div className="text-[7px] text-stone-500 font-medium">
                        GitHub: @parthtiwari2599
                      </div>
                      <div className="text-[7px] text-stone-500 font-medium">
                        parthtiwari2599@gmail.com
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-20 pb-16 sm:pb-32 grid lg:grid-cols-2 gap-10 sm:gap-20 items-center">
              <div className="space-y-6 sm:space-y-8">
                <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tighter italic leading-[0.8] text-stone-900">
                  VANISH <br /> <span className="text-emerald-600">INTO</span>{" "}
                  <br /> DATA.
                </h1>
                <p className="text-stone-500 text-lg sm:text-xl max-w-md font-medium leading-relaxed">
                  DRIFT is an ephemeral communication layer where messages
                  don't last, but impact does.
                </p>
                {(!user || user.isAnonymous) && (
                  <button
                    onClick={signInWithGoogle}
                    className="flex items-center gap-3 sm:gap-4 bg-emerald-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200"
                  >
                    Start Drifting <ArrowRight size={20} />
                  </button>
                )}
              </div>

              {user && !user.isAnonymous && (
                <div
                  id="create-room"
                  className="bg-white border border-stone-200 p-6 sm:p-8 md:p-12 rounded-[2rem] sm:rounded-[3rem] shadow-2xl shadow-stone-200/50 w-full max-w-lg mx-auto lg:mx-0"
                >
                  <h2 className="text-lg sm:text-xl font-black uppercase tracking-widest mb-6 sm:mb-8 flex items-center gap-3 text-stone-900">
                    <Terminal size={20} className="text-emerald-600" /> New Signal
                  </h2>
                  <div className="space-y-4 sm:space-y-6">
                    <input
                      type="text"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="Room Name..."
                      className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 sm:px-6 py-3 sm:py-4 outline-none focus:border-emerald-500 transition-all font-bold text-sm sm:text-base text-stone-900"
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
                          className="w-4 h-4 text-emerald-600 bg-stone-100 border-stone-300 rounded focus:ring-emerald-500 focus:ring-2"
                        />
                        <span className="text-xs sm:text-sm text-stone-500 font-medium">
                          Make room password protected
                        </span>
                      </label>
                    </div>

                    {/* Password Fields */}
                    {showPasswordFields && (
                      <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-stone-50 border border-stone-200 rounded-2xl">
                        <div>
                          <input
                            type="password"
                            value={roomPassword}
                            onChange={(e) => setRoomPassword(e.target.value)}
                            placeholder="Enter password (min 4 characters)"
                            className="w-full bg-white border border-stone-300 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-stone-900 placeholder-stone-400 focus:outline-none focus:border-emerald-500 font-medium text-sm sm:text-base"
                          />
                        </div>
                        <div>
                          <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm password"
                            className="w-full bg-white border border-stone-300 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-stone-900 placeholder-stone-400 focus:outline-none focus:border-emerald-500 font-medium text-sm sm:text-base"
                          />
                        </div>
                        <div className="text-xs text-stone-400 font-medium">
                          Password will be required for all users to join this
                          room
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleCreateRoom}
                      className="w-full bg-stone-900 text-white py-4 sm:py-5 rounded-2xl font-black uppercase tracking-widest text-xs sm:text-sm hover:bg-emerald-600 transition-all shadow-lg"
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
                  <span className="text-emerald-600 font-black uppercase tracking-[0.3em] text-[10px]">
                    Network Monitor
                  </span>
                  <h2 className="text-3xl sm:text-4xl font-black italic tracking-tighter text-stone-900">
                    ACTIVE UPLINKS
                  </h2>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-stone-500 max-w-xs text-sm font-medium">
                    Real-time signals currently broadcasting on the DRIFT
                    protocol.
                  </p>
                  <button
                    onClick={findAndOpenRoom}
                    className="px-4 py-2 bg-white border border-stone-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-stone-600 hover:text-emerald-600 transition-all shadow-sm"
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
                    className="group bg-white border border-stone-200 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] cursor-pointer hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-100 transition-all"
                  >
                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                      <div className="p-3 bg-stone-50 rounded-2xl group-hover:bg-emerald-50 transition-colors">
                        <Hash
                          className="text-stone-400 group-hover:text-emerald-600"
                          size={28}
                        />
                      </div>
                      {room.isLocked && <Lock className="text-emerald-400" size={20} />}
                    </div>
                    <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight mb-2 flex items-center gap-2 text-stone-800">
                      {room.topic}
                    </h3>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                        {room.activeCount || 0} Nodes
                      </span>
                    </div>
                    {room.isLocked && (
                      <p className="text-xs text-emerald-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                        PASSWORD_PROTECTED
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* --- "WHAT IS DRIFT" SECTION (THE STORY) --- */}
          <section className="bg-white py-16 sm:py-32 border-y border-stone-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-10 sm:gap-20 items-center">
              <div className="relative aspect-square bg-stone-100 rounded-[3rem] sm:rounded-[4rem] overflow-hidden border border-stone-200 group order-2 md:order-1">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-emerald-200/20 opacity-50" />
                <div className="absolute inset-0 flex items-center justify-center p-8 sm:p-12">
                  <div className="space-y-3 sm:space-y-4 font-mono text-[9px] sm:text-[10px] text-emerald-600 opacity-40 group-hover:opacity-100 transition-opacity">
                    <p>{">"} INITIALIZING SECURE_LAYER...</p>
                    <p>{">"} ENCRYPTING END_TO_END...</p>
                    <p>{">"} DELETING METADATA...</p>
                    <p>{">"} STATUS: ANONYMOUS</p>
                  </div>
                </div>
              </div>
              <div className="space-y-6 sm:space-y-8 order-1 md:order-2">
                <h2 className="text-4xl sm:text-5xl font-black italic tracking-tighter text-stone-900 uppercase">
                  BUILT FOR <br /> SILENCE.
                </h2>
                <div className="space-y-4 sm:space-y-6 text-stone-500 leading-relaxed font-medium">
                  <p>
                    DRIFT is not just another chat app. It's a response to the
                    era of surveillance. We believe your conversations should
                    belong to the air, not to a server.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 pt-6 sm:pt-8">
                    <div className="space-y-2">
                      <Shield className="text-emerald-600" size={24} />
                      <h4 className="font-black text-xs uppercase tracking-widest text-stone-900">
                        No Persistence
                      </h4>
                      <p className="text-[10px]">
                        Data exists only while the room is active.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Sparkles className="text-emerald-500" size={24} />
                      <h4 className="font-black text-xs uppercase tracking-widest text-stone-900">
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
                <div
                  className="absolute inset-0 bg-stone-900/20 backdrop-blur-sm"
                  onClick={() => setShowSettingsModal(false)}
                />

                <div className="relative bg-white border border-stone-200 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-black text-stone-900">Settings</h3>
                    <button
                      onClick={() => setShowSettingsModal(false)}
                      className="p-2 hover:bg-stone-50 border border-stone-200 rounded-lg transition-all"
                    >
                      <X size={20} className="text-stone-500" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-stone-400 mb-2">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={tempDisplayName}
                        onChange={(e) => setTempDisplayName(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-stone-900 placeholder-stone-400 focus:outline-none focus:border-emerald-500 font-bold"
                        placeholder="Enter your display name"
                        maxLength={30}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-stone-400 mb-3">
                        Choose Avatar
                      </label>
                      <div className="grid grid-cols-4 gap-3">
                        {[
                          "👤", "🎭", "🤖", "👨‍💻", "👩‍💻", "🦊", "🐺", "🐱",
                          "🦁", "🐼", "🐨", "🦄", "🐉", "🌟", "⚡", "🔥",
                        ].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => setSelectedAvatar(emoji)}
                            className={`aspect-square rounded-xl border-2 text-2xl flex items-center justify-center transition-all ${
                              selectedAvatar === emoji
                                ? "border-emerald-500 bg-emerald-50"
                                : "border-stone-100 hover:border-stone-300"
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={() => setShowSettingsModal(false)}
                        className="flex-1 px-4 py-3 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl transition-all font-bold text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveSettings}
                        className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all font-bold text-sm shadow-lg shadow-emerald-100"
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
              <h2 className="text-4xl sm:text-6xl font-black italic tracking-tighter text-stone-900 uppercase">
                PROTOCOL PHASES
              </h2>
              <p className="text-stone-400 uppercase tracking-[0.3em] text-[10px] font-bold">
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
                  className="p-6 sm:p-10 bg-white border border-stone-200 rounded-2xl sm:rounded-3xl space-y-4 sm:space-y-6 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-50 transition-all"
                >
                  <span className="text-3xl sm:text-4xl font-black text-emerald-600 opacity-20">
                    {item.step}
                  </span>
                  <h3 className="text-lg sm:text-xl font-black italic tracking-tight text-stone-800">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-500 leading-relaxed font-medium">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* --- FOOTER --- */}
          <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20 border-t border-stone-200 flex flex-col gap-8 sm:gap-12">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-6 sm:gap-8">
              <div className="flex items-center gap-2 opacity-50">
                <Zap size={14} fill="#57534e" className="text-stone-600" />
                <span className="font-black italic tracking-tighter text-lg sm:text-xl text-stone-800">
                  DRIFT. v2.0
                </span>
              </div>

              {/* Contact Information */}
              <div className="text-center space-y-2 order-3 sm:order-2">
                <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.4em] text-stone-300">
                  DEVELOPED BY
                </div>
                <div className="text-sm sm:text-base font-bold text-emerald-600">
                  Parth Tiwari
                </div>
                <div className="text-[8px] sm:text-[9px] text-stone-500 font-medium">
                  GitHub:{" "}
                  <a
                    href={githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-emerald-600 underline underline-offset-2"
                  >
                    @parthtiwari2599
                  </a>
                </div>
                <div className="text-[8px] sm:text-[9px] text-stone-500 font-medium">
                  Email: parthtiwari2599@gmail.com
                </div>
                <div className="text-[7px] sm:text-[8px] text-stone-400 font-black uppercase tracking-widest mt-2">
                  Suggestions & Contributions Welcome
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-stone-400 order-2 sm:order-3">
                <a
                  href={linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald-600 transition-colors"
                >
                  LinkedIn
                </a>
                <span className="hover:text-emerald-600 cursor-default transition-colors">
                  Security
                </span>
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald-600 transition-colors"
                >
                  GitHub
                </a>
              </div>
            </div>

            <div className="text-center">
              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.4em] text-stone-300">
                © 2026 ZERO_LOG_SYSTEMS_LLC
              </p>
            </div>
          </footer>
        </main>
      </div>
    </>
  );
}


