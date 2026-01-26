"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { getRoom, getUserData, updateUserData } from "@/lib/firestore";
import {
    sendMessageToRoom,
    listenToRoomMessages,
    addReactionToMessage,
    removeReactionFromMessage,
    cleanupExpiredMessages,
} from "@/lib/messages";
import {
    sendConnectRequest,
    listenIncomingRequests,
    acceptRequest,
    rejectRequest,
    listenAcceptedRequests,
    listenSentRequests,
} from "@/lib/connect";
import { useAuth } from "@/hooks/useAuth";
import {
    listenToRoomPresence,
    listenToRoomPresenceUsers,
    joinRoomPresence,
    leaveRoomPresence,
    heartbeatPresence,
} from "@/lib/presence";
import { listenMyPrivateRooms } from "@/lib/privateRooms";
import { sendPrivateMessage, listenPrivateMessages } from "@/lib/privateMessages";
import { deleteRoom } from "@/lib/firestore";
import { db, generateRandomAvatar, generateAvatarFromName } from "@/lib/firebase";
import { collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import {
    Send,
    Users,
    ChevronLeft,
    ShieldCheck,
    UserCheck,
    Clock,
    Hash,
    Zap,
    Radio,
    Smile,
    Trash2,
    Search,
    X,
    Sun,
    Moon,
    Reply,
    Shield,
    Lock,
    Trash,
    Menu,
    House,
    MessageCircle,
    Settings,
    User,
    LogOut,
} from "lucide-react";
import EmojiPicker from "emoji-picker-react";

export default function RoomPage() {
    const { roomId } = useParams();
    const router = useRouter();
    const { user } = useAuth();

    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<any[]>([]);
    const [activeCount, setActiveCount] = useState(0);
    const [activeUsers, setActiveUsers] = useState<any[]>([]);
    const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
    const [sentRequests, setSentRequests] = useState<string[]>([]);
    const [privateRooms, setPrivateRooms] = useState<any[]>([]);
    const [currentChat, setCurrentChat] = useState<"group" | string>("group");
    const [privateMessages, setPrivateMessages] = useState<{ [roomId: string]: any[] }>({});
    const [roomData, setRoomData] = useState<any>(null);
    const [roomLoading, setRoomLoading] = useState(true);
    const [userNames, setUserNames] = useState<{ [uid: string]: string }>({});
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempDisplayName, setTempDisplayName] = useState("");
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [connectionStatuses, setConnectionStatuses] = useState<{
        [userId: string]: "none" | "pending" | "accepted" | "rejected";
    }>({});
    const [typingUsers, setTypingUsers] = useState<{ [userId: string]: string }>({});
    const [isTyping, setIsTyping] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [showSearch, setShowSearch] = useState(false);
    const [theme, setTheme] = useState<"dark" | "light">("dark");
    const [replyingTo, setReplyingTo] = useState<any>(null);
    const [encryptionEnabled, setEncryptionEnabled] = useState(false);
    const [userAvatars, setUserAvatars] = useState<{ [uid: string]: string }>({});
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [settingsTempDisplayName, setSettingsTempDisplayName] = useState("");
    const [selectedAvatar, setSelectedAvatar] = useState("");
    const [showConnectionAnimation, setShowConnectionAnimation] = useState(false);
    const [newConnectionUser, setNewConnectionUser] = useState<string | null>(null);
    const [animationTriggered, setAnimationTriggered] = useState(false);
    const [prevPrivateRoomsLength, setPrevPrivateRoomsLength] = useState(0);

    const bottomRef = useRef<HTMLDivElement | null>(null);

    // LOGIC: Unchanged (As requested)
    useEffect(() => {
        if (!roomId) return;
        getRoom(roomId as string)
            .then((room) => {
                setRoomData(room);
                setRoomLoading(false);
            })
            .catch(() => setRoomLoading(false));
    }, [roomId]);

    useEffect(() => {
        if (!roomId || !user) return;
        const unsubs = [
            listenToRoomMessages(roomId as string, setMessages),
            listenToRoomPresence(roomId as string, setActiveCount),
            listenToRoomPresenceUsers(roomId as string, setActiveUsers),
            listenIncomingRequests(user.uid, setIncomingRequests),
            listenSentRequests(user.uid, setSentRequests),
            listenMyPrivateRooms(user.uid, setPrivateRooms),
            listenAcceptedRequests(user.uid, (reqs) => {
                if (reqs.length > 0 && reqs[0].privateRoomId) {
                    setCurrentChat(reqs[0].privateRoomId);
                    // Trigger connection animation
                    const otherUserId = reqs[0].fromUser === user.uid ? reqs[0].toUser : reqs[0].fromUser;
                    const otherUserName = userNames[otherUserId] || `User ${otherUserId.slice(-4)}`;
                    setNewConnectionUser(otherUserName);
                    setShowConnectionAnimation(true);
                    setAnimationTriggered(true);
                    setTimeout(() => {
                        setShowConnectionAnimation(false);
                        setAnimationTriggered(false);
                    }, 2500); // Hide after 2.5 seconds
                }
            }),
        ];
        joinRoomPresence(roomId as string, user.uid);
        const hb = setInterval(() => heartbeatPresence(roomId as string, user.uid), 5000);
        return () => {
            unsubs.forEach((unsub) => unsub());
            leaveRoomPresence(roomId as string, user.uid);
            clearInterval(hb);
        };
    }, [roomId, user]);

    useEffect(() => {
        const unsubs = privateRooms.map((room) =>
            listenPrivateMessages(room.id, (msgs) => {
                setPrivateMessages((prev) => ({ ...prev, [room.id]: msgs }));
            })
        );
        return () => unsubs.forEach((unsub) => unsub());
    }, [privateRooms]);

    // Trigger animation for sender when private room is created from accepted request
    useEffect(() => {
        if (privateRooms.length > prevPrivateRoomsLength && !animationTriggered) {
            const latestRoom = privateRooms[privateRooms.length - 1];
            const otherUserId = latestRoom.userA === user?.uid ? latestRoom.userB : latestRoom.userA;
            const otherUserName = userNames[otherUserId] || `User ${otherUserId?.slice(-4)}`;
            setNewConnectionUser(otherUserName);
            setShowConnectionAnimation(true);
            setAnimationTriggered(true);
            setTimeout(() => {
                setShowConnectionAnimation(false);
                setAnimationTriggered(false);
            }, 2500); // Reduced to 2.5 seconds
        }
        setPrevPrivateRoomsLength(privateRooms.length);
    }, [privateRooms, animationTriggered, userNames, user, prevPrivateRoomsLength]);

    // Automatic cleanup of expired messages every 30 minutes
    useEffect(() => {
        const cleanupInterval = setInterval(() => {
            cleanupExpiredMessages();
        }, 30 * 60 * 1000); // 30 minutes

        // Run cleanup immediately when component mounts
        cleanupExpiredMessages();

        return () => clearInterval(cleanupInterval);
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, privateMessages, currentChat]);

    // Load user display names for all active users
    useEffect(() => {
        const loadUserNames = async () => {
            const names: { [uid: string]: string } = {};
            const avatars: { [uid: string]: string } = {};

            for (const activeUser of activeUsers) {
                if (activeUser.userId && activeUser.userId !== user?.uid) {
                    try {
                        const userData = await getUserData(activeUser.userId);
                        if (userData?.customDisplayName) {
                            names[activeUser.userId] = userData.customDisplayName;
                        } else {
                            names[activeUser.userId] = `User ${activeUser.userId.slice(-4)}`;
                        }

                        if (userData?.customAvatar) {
                            avatars[activeUser.userId] = userData.customAvatar;
                        } else {
                            avatars[activeUser.userId] = generateRandomAvatar(activeUser.userId);
                        }
                    } catch (error) {
                        names[activeUser.userId] = `User ${activeUser.userId.slice(-4)}`;
                        avatars[activeUser.userId] = generateRandomAvatar(activeUser.userId);
                    }
                }
            }

            if (user?.uid) {
                try {
                    const userData = await getUserData(user.uid);
                    if (userData?.customAvatar) {
                        avatars[user.uid] = userData.customAvatar;
                    } else {
                        avatars[user.uid] = generateRandomAvatar(user.uid);
                    }
                } catch (error) {
                    avatars[user.uid] = generateRandomAvatar(user.uid);
                }
            }

            setUserNames((prev) => ({ ...prev, ...names }));
            setUserAvatars((prev) => ({ ...prev, ...avatars }));
        };
        if (activeUsers.length > 0) {
            loadUserNames();
        }
    }, [activeUsers, user]);

    // Load connection statuses for all active users
    useEffect(() => {
        const loadConnectionStatuses = async () => {
            if (!user) return;
            const statuses: { [userId: string]: "none" | "pending" | "accepted" | "rejected" } = {};

            for (const activeUser of activeUsers) {
                if (!activeUser.userId || activeUser.userId === user.uid) continue;

                try {
                    const sentQueryRef = query(
                        collection(db, "connection_requests"),
                        where("fromUser", "==", user.uid),
                        where("toUser", "==", activeUser.userId)
                    );
                    const sentSnap = await getDocs(sentQueryRef);

                    if (!sentSnap.empty) {
                        const request = sentSnap.docs[0].data();
                        statuses[activeUser.userId] = request.status as "pending" | "accepted" | "rejected";
                        continue;
                    }

                    const receivedQueryRef = query(
                        collection(db, "connection_requests"),
                        where("fromUser", "==", activeUser.userId),
                        where("toUser", "==", user.uid)
                    );
                    const receivedSnap = await getDocs(receivedQueryRef);

                    if (!receivedSnap.empty) {
                        const request = receivedSnap.docs[0].data();
                        statuses[activeUser.userId] = request.status as "pending" | "accepted" | "rejected";
                    } else {
                        statuses[activeUser.userId] = "none";
                    }
                } catch (error) {
                    statuses[activeUser.userId] = "none";
                }
            }

            setConnectionStatuses(statuses);
        };

        if (activeUsers.length > 0 && user) {
            loadConnectionStatuses();
        }
    }, [activeUsers, user, sentRequests, incomingRequests]);

    const handleSend = async () => {
        if (!user || !input.trim()) return;
        const msgText = input;
        const replyData = replyingTo;
        setInput("");
        setReplyingTo(null);

        try {
            if (currentChat === "group") {
                await sendMessageToRoom(roomId as string, msgText, user.uid, "text", "never", replyData);
            } else {
                await sendPrivateMessage(currentChat, msgText, user.uid, "text", "never", replyData);
            }
        } catch (error: any) {
            console.error("Failed to send message:", error);

            const errorMessage = error.message?.includes("No internet connection")
                ? "No internet connection. Your message will be sent when connection is restored."
                : error.message?.includes("permission")
                    ? "You don't have permission to send messages in this room."
                    : "Failed to send message. Please try again.";

            alert(errorMessage);

            if (error.message?.includes("No internet connection")) {
                setInput(msgText);
                setReplyingTo(replyData);
            }
        }
    };

    const handleDeleteMessage = async (messageId: string) => {
        if (!user) return;

        try {
            const messageRef = doc(db, "messages", messageId);
            await deleteDoc(messageRef);
        } catch (error) {
            console.error("Error deleting message:", error);
        }
    };

    const handleDeleteRoom = async () => {
        if (!user || !roomData) return;

        const decodedTopic = roomData?.topic ? decodeURIComponent(roomData.topic) : "General Chat";
        const confirmDelete = window.confirm(
            `Are you sure you want to delete the room "${decodedTopic}"? This action cannot be undone and all messages will be lost.`
        );

        if (!confirmDelete) return;

        try {
            await deleteRoom(roomId as string, user.uid);
            router.push("/");
        } catch (error) {
            alert("Failed to delete room: " + (error as Error).message);
        }
    };

    const handleSaveDisplayName = async () => {
        if (!user || !tempDisplayName.trim()) return;
        const success = await updateUserData(user.uid, { customDisplayName: tempDisplayName.trim() });
        if (success) {
            setUserNames((prev) => ({ ...prev, [user.uid]: tempDisplayName.trim() }));
            setIsEditingName(false);
        }
    };

    const handleEmojiClick = (emojiData: any) => {
        setInput((prev) => prev + emojiData.emoji);
        setShowEmojiPicker(false);
    };

    const handleAddReaction = async (messageId: string, emoji: string) => {
        if (!user) return;
        try {
            await addReactionToMessage(messageId, emoji, user.uid);
        } catch (error) {
            console.error("Error adding reaction:", error);
        }
    };

    const handleRemoveReaction = async (messageId: string, emoji: string) => {
        if (!user) return;
        try {
            await removeReactionFromMessage(messageId, emoji, user.uid);
        } catch (error) {
            console.error("Error removing reaction:", error);
        }
    };

    const handleTypingStart = () => {
        if (!user || !roomId || isTyping) return;
        setIsTyping(true);
    };

    const handleTypingStop = () => {
        if (!isTyping) return;
        setIsTyping(false);
    };

    const handleInputChange = (value: string) => {
        setInput(value);
        if (value.trim() && !isTyping) {
            handleTypingStart();
        } else if (!value.trim() && isTyping) {
            handleTypingStop();
        }
    };

    const handleSaveSettings = async () => {
        if (!user) return;

        try {
            await updateUserData(user.uid, {
                customDisplayName: settingsTempDisplayName.trim() || undefined,
                customAvatar: selectedAvatar || undefined,
            });

            setUserNames((prev) => ({
                ...prev,
                [user.uid]: settingsTempDisplayName.trim() || `User ${user.uid.slice(-4)}`,
            }));

            setUserAvatars((prev) => ({
                ...prev,
                [user.uid]: selectedAvatar || generateRandomAvatar(user.uid),
            }));

            setShowSettingsModal(false);
        } catch (error) {
            console.error("Failed to update settings:", error);
        }
    };

    if (roomLoading)
        return (
            <div className="h-screen bg-[#050505] flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <div className="text-blue-500 font-mono text-[10px] uppercase tracking-[0.5em] animate-pulse">
                    Establishing Secure Uplink...
                </div>
            </div>
        );

    if (!user)
        return (
            <div className="h-screen bg-black flex items-center justify-center">
                <div className="border border-red-900/50 bg-red-950/10 p-8 rounded-3xl text-center">
                    <p className="text-red-500 font-mono text-xs uppercase tracking-widest">
                        Authentication Required
                    </p>
                    <button
                        onClick={() => router.push("/")}
                        className="mt-4 text-white bg-red-600 px-6 py-2 rounded-xl text-xs font-bold uppercase"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );

    const decodedTopic = roomData?.topic ? decodeURIComponent(roomData.topic) : "General Chat";

    return (
        <>
            {/* OUTER: height fix + scroll allowed on small screens */}
            <div
                className={`min-h-screen h-[100dvh] w-full ${theme === "dark" ? "bg-[#050505] text-zinc-300" : "bg-gray-100 text-gray-800"
                    } overflow-hidden`}
            >
                <div
                    className={`flex h-full w-full mx-auto ${theme === "dark" ? "bg-[#050505]" : "bg-gray-100"
                        } overflow-hidden`}
                >
                    {/* SIDEBAR */}
                    <aside
                        className={`hidden sm:flex flex-shrink-0 w-72 xl:w-80 ${theme === "dark" ? "bg-black/40 border-zinc-800/50" : "bg-white/80 border-gray-300/50"
                            } flex-col z-30 backdrop-blur-2xl border-r`}
                    >
                        <div className="p-5 xl:p-8 border-b border-zinc-800/50 relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-600 to-transparent opacity-50" />
                            <div className="flex items-center justify-between mb-4 xl:mb-6">
                                <button
                                    onClick={() => router.push("/")}
                                    className="flex items-center text-[9px] text-zinc-600 hover:text-white transition-all uppercase font-black tracking-[0.2em]"
                                >
                                    <ChevronLeft size={14} className="mr-1" /> Exit Protocol
                                </button>
                                {roomData?.createdBy === user?.uid && (
                                    <button
                                        onClick={handleDeleteRoom}
                                        className="flex items-center text-[9px] text-red-500 hover:text-red-400 transition-all uppercase font-black tracking-[0.2em] hover:bg-red-500/10 px-2 py-1 rounded"
                                        title="Delete Room"
                                    >
                                        <Trash size={12} className="mr-1" /> Delete
                                    </button>
                                )}
                            </div>
                            <h1 className="text-lg xl:text-2xl font-black text-white truncate tracking-tighter flex items-center gap-2">
                                <Hash className="text-blue-600" size={20} />
                                <span className="truncate">{decodedTopic.toUpperCase()}</span>
                                {roomData?.isLocked && <Lock size={16} className="text-yellow-500" />}
                            </h1>
                            <div className="flex items-center gap-2 mt-3 bg-blue-600/5 w-fit px-3 py-1 rounded-full border border-blue-500/10">
                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_#3b82f6]" />
                                <p className="text-[10px] text-blue-400 uppercase tracking-widest font-black">
                                    {activeCount} Nodes Online
                                </p>
                            </div>

                            {/* Display Name Editor */}
                            <div className="mt-5 xl:mt-6 p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-2xl">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-[11px] font-black text-zinc-400 uppercase tracking-wider">
                                        Your Identity
                                    </h3>
                                    {!isEditingName && (
                                        <button
                                            onClick={() => {
                                                setTempDisplayName(
                                                    userNames[user.uid] || user.displayName || ""
                                                );
                                                setIsEditingName(true);
                                            }}
                                            className="text-[9px] text-blue-500 hover:text-blue-400 font-bold uppercase"
                                        >
                                            Edit
                                        </button>
                                    )}
                                </div>
                                {isEditingName ? (
                                    <div className="space-y-3">
                                        <input
                                            value={tempDisplayName}
                                            onChange={(e) => setTempDisplayName(e.target.value)}
                                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                                            placeholder="Enter your display name..."
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") handleSaveDisplayName();
                                                if (e.key === "Escape") setIsEditingName(false);
                                            }}
                                            autoFocus
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleSaveDisplayName}
                                                className="flex-1 bg-blue-600 text-white text-xs py-2 rounded-lg font-bold hover:bg-blue-500 transition-colors"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => setIsEditingName(false)}
                                                className="flex-1 bg-zinc-700 text-zinc-300 text-xs py-2 rounded-lg font-bold hover:bg-zinc-600 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-white font-medium truncate">
                                        {userNames[user.uid] || user.displayName || "Anonymous Node"}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10 space-y-6 sm:space-y-8 lg:space-y-10 custom-scrollbar">

                            {/* Private Conversations */}
                            <section>
                                <h3 className="text-[10px] text-zinc-700 font-black uppercase tracking-[0.3em] mb-4 px-3 flex items-center gap-2">
                                    <ShieldCheck size={14} className="text-zinc-500" /> Secure Sessions
                                </h3>
                                <div
                                    onClick={() => setCurrentChat("group")}
                                    className={`group flex items-center justify-between p-3 xl:p-4 rounded-2xl cursor-pointer transition-all mb-2 border ${currentChat === "group"
                                        ? "bg-white text-black border-white shadow-[0_10px_30px_rgba(255,255,255,0.05)]"
                                        : "hover:bg-zinc-900/50 border-transparent text-zinc-500 hover:text-zinc-200"
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Radio
                                            size={18}
                                            className={
                                                currentChat === "group"
                                                    ? "text-black"
                                                    : "text-zinc-700 group-hover:text-blue-500"
                                            }
                                        />
                                        <span className="text-xs font-black uppercase">Public Stream</span>
                                    </div>
                                    {currentChat === "group" && (
                                        <div className="w-1.5 h-1.5 bg-black rounded-full" />
                                    )}
                                </div>

                                {privateRooms.map((room) => {
                                    const otherUserId =
                                        room.userA === user?.uid ? room.userB : room.userA;
                                    const otherUserName =
                                        userNames[otherUserId] || `User ${otherUserId?.slice(-4)}`;

                                    return (
                                        <div
                                            key={room.id}
                                            onClick={() => setCurrentChat(room.id)}
                                            className={`flex items-center gap-3 p-3 xl:p-4 rounded-2xl cursor-pointer transition-all mb-2 border ${currentChat === room.id
                                                ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20"
                                                : "hover:bg-zinc-900/50 border-transparent text-zinc-500 hover:text-zinc-200"
                                                }`}
                                        >
                                            <div
                                                className={`w-2 h-2 rounded-full ${currentChat === room.id
                                                    ? "bg-white animate-pulse"
                                                    : "bg-blue-600/40"
                                                    }`}
                                            />
                                            <span className="text-xs font-black uppercase tracking-tight truncate">
                                                {otherUserName}
                                            </span>
                                        </div>
                                    );
                                })}
                            </section>

                            {/* Peer Discovery */}
                            <section>
                                <h3 className="text-[10px] text-zinc-700 font-black uppercase tracking-[0.3em] mb-4 px-3 flex items-center gap-2">
                                    <Zap size={14} className="text-zinc-500" /> Proximity
                                </h3>
                                {activeUsers.map((u) => {
                                    const alreadyConnected = privateRooms.find(
                                        (r) => r.userA === u.userId || r.userB === u.userId
                                    );
                                    const connectionStatus =
                                        connectionStatuses[u.userId] || "none";

                                    return (
                                        <div
                                            key={u.id}
                                            className="flex justify-between items-center p-3 group hover:bg-zinc-900/30 rounded-2xl transition-all border border-transparent hover:border-zinc-800/50 mb-1"
                                        >
                                            <div className="flex flex-col">
                                                <span
                                                    className={`text-xs font-black tracking-tight ${u.userId === user.uid ? "text-blue-500" : "text-zinc-400"
                                                        }`}
                                                >
                                                    {u.userId === user.uid
                                                        ? "YOU (HOST)"
                                                        : userNames[u.userId] ||
                                                        `User ${u.userId.slice(-4)}`}
                                                </span>
                                                <span className="text-[8px] text-zinc-600 font-bold uppercase">
                                                    Active Now
                                                </span>
                                            </div>
                                            {u.userId !== user.uid && (
                                                <>
                                                    {alreadyConnected ? (
                                                        <div className="bg-blue-600/10 p-2 rounded-lg text-blue-500">
                                                            <UserCheck size={14} />
                                                        </div>
                                                    ) : connectionStatus === "pending" ? (
                                                        <span className="text-[9px] text-zinc-600 border border-zinc-800 px-3 py-1 rounded-full uppercase font-black">
                                                            Waiting
                                                        </span>
                                                    ) : connectionStatus === "accepted" ? (
                                                        <div className="bg-green-600/10 p-2 rounded-lg text-green-500">
                                                            <UserCheck size={14} />
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() =>
                                                                sendConnectRequest(user.uid, u.userId, decodedTopic)
                                                            }
                                                            className="text-[9px] bg-white text-black px-4 py-2 rounded-xl font-black uppercase transition-all hover:scale-105 active:scale-95 shadow-lg shadow-white/5"
                                                        >
                                                            Connect
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </section>
                        </div>

                        {/* Settings Section */}
                        <div className="px-3 xl:px-4 py-4 xl:py-6 border-t border-zinc-800/50">
                            <button
                                onClick={() => {
                                    setSettingsTempDisplayName(
                                        userNames[user.uid] || user.displayName || ""
                                    );
                                    setSelectedAvatar(
                                        userAvatars[user.uid] || generateRandomAvatar(user.uid)
                                    );
                                    setShowSettingsModal(true);
                                }}
                                className="w-full flex items-center gap-3 p-3 hover:bg-zinc-900/50 rounded-xl transition-all text-left"
                            >
                                <Settings size={16} className="text-zinc-400" />
                                <span className="text-sm font-medium">Settings</span>
                            </button>
                        </div>
                    </aside>

                    {/* MAIN CHAT */}
                    <main
                        className={`flex-1 flex flex-col relative ${theme === "dark" ? "bg-[#050505]" : "bg-gray-50"
                            }`}
                    >
                        <header className="h-16 sm:h-20 border-b border-zinc-900 flex items-center px-3 sm:px-6 lg:px-10 justify-between bg-black/20 backdrop-blur-md z-20">
                            <div className="flex items-center gap-3 sm:gap-4">
                                {/* Mobile Hamburger Menu */}
                                <button
                                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                    className="sm:hidden p-2 hover:bg-zinc-900/50 rounded-lg transition-all"
                                >
                                    {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                                </button>

                                <div className="flex flex-col">
                                    <h2 className="text-[9px] sm:text-[11px] font-black tracking-[0.32em] sm:tracking-[0.4em] uppercase text-zinc-500">
                                        {currentChat === "group"
                                            ? "Signal: Global_Broadcast"
                                            : "Signal: Peer_To_Peer_Encrypted"}
                                    </h2>
                                    <p className="text-[8px] sm:text-[9px] text-blue-600 font-bold uppercase tracking-widest mt-0.5">
                                        Latency: 2ms • Security: {encryptionEnabled ? "E2E Encrypted" : "High"}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center -space-x-2 sm:-space-x-2">
                                {[1, 2, 3].map((i) => (
                                    <div
                                        key={i}
                                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-[#050505] bg-zinc-800"
                                    />
                                ))}
                                <button
                                    onClick={() => setShowSearch(!showSearch)}
                                    className="ml-1 sm:ml-2 w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-zinc-700/50 bg-zinc-800/50 hover:bg-zinc-700/50 flex items-center justify-center transition-all"
                                    title="Search messages"
                                >
                                    <Search size={14} className="text-zinc-400" />
                                </button>
                                <button
                                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                                    className="ml-1 sm:ml-2 w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-zinc-700/50 bg-zinc-800/50 hover:bg-zinc-700/50 flex items-center justify-center transition-all"
                                    title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                                >
                                    {theme === "dark" ? (
                                        <Sun size={14} className="text-zinc-400" />
                                    ) : (
                                        <Moon size={14} className="text-zinc-400" />
                                    )}
                                </button>
                                <button
                                    onClick={() => setEncryptionEnabled(!encryptionEnabled)}
                                    className={`ml-1 sm:ml-2 w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center transition-all ${encryptionEnabled
                                        ? "border-green-500/50 bg-green-900/20"
                                        : "border-zinc-700/50 bg-zinc-800/50 hover:bg-zinc-700/50"
                                        }`}
                                    title={`${encryptionEnabled ? "Disable" : "Enable"
                                        } end-to-end encryption`}
                                >
                                    <Shield
                                        size={14}
                                        className={encryptionEnabled ? "text-green-400" : "text-zinc-400"}
                                    />
                                </button>
                            </div>
                        </header>

                        {/* Search Bar */}
                        {showSearch && (
                            <div className="px-3 sm:px-6 lg:px-10 py-3 sm:py-4 bg-zinc-900/50 border-b border-zinc-800/50">
                                <div className="max-w-4xl mx-auto relative">
                                    <Search
                                        size={16}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                                    />
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Search messages..."
                                        className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg pl-10 pr-24 py-2 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50"
                                    />
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                                        {searchTerm && (
                                            <button
                                                onClick={() => setSearchTerm("")}
                                                className="px-2 py-1 text-[10px] sm:text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 hover:text-red-300 rounded font-medium transition-colors"
                                                title="Clear search"
                                            >
                                                Clear
                                            </button>
                                        )}
                                        <button
                                            onClick={() => {
                                                setSearchTerm("");
                                                setShowSearch(false);
                                            }}
                                            className="px-2 py-1 text-[10px] sm:text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 hover:text-white rounded font-medium transition-colors"
                                            title="Close search"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                                {searchTerm && (
                                    <div className="max-w-4xl mx-auto mt-1 sm:mt-2 text-[10px] sm:text-xs text-zinc-500">
                                        Showing messages containing "{searchTerm}" •
                                        <button
                                            onClick={() => setSearchTerm("")}
                                            className="text-blue-400 hover:text-blue-300 underline ml-1"
                                        >
                                            Show all messages
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Notifications */}
                        {incomingRequests.length > 0 && (
                            <div className="absolute top-20 sm:top-24 left-1/2 -translate-x-1/2 w-full max-w-sm z-40 px-3 sm:px-4">
                                {incomingRequests.map((req) => (
                                    <div
                                        key={req.id}
                                        className="bg-zinc-900/90 border border-blue-600/30 p-4 sm:p-5 rounded-3xl shadow-2xl backdrop-blur-xl flex flex-col gap-4 animate-in slide-in-from-top-10 duration-500"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-600 rounded-xl">
                                                <Zap size={16} className="text-white" />
                                            </div>
                                            <p className="text-[10px] sm:text-[11px] font-black uppercase text-white leading-none">
                                                Incoming Handshake
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => acceptRequest(req.id)}
                                                className="flex-1 bg-white text-black text-[10px] py-2.5 rounded-xl font-black uppercase hover:bg-blue-600 hover:text-white transition-all"
                                            >
                                                Accept
                                            </button>
                                            <button
                                                onClick={() => rejectRequest(req.id)}
                                                className="flex-1 bg-zinc-800 text-zinc-400 text-[10px] py-2.5 rounded-xl font-black uppercase hover:bg-zinc-700 transition-all"
                                            >
                                                Ignore
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Connection Animation */}
                        {showConnectionAnimation && newConnectionUser && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                                <div className="bg-black/50 backdrop-blur-sm absolute inset-0" />
                                <div className="relative z-10 text-center animate-in fade-in duration-500">
                                    <div className="text-6xl mb-4 animate-bounce">🎉</div>
                                    <h2 className="text-2xl font-black text-white mb-2 animate-pulse">
                                        Connection Established!
                                    </h2>
                                    <p className="text-lg text-blue-400 font-medium">
                                        You are now connected with {newConnectionUser}
                                    </p>
                                    {/* Floating Emojis */}
                                    <div className="absolute inset-0 pointer-events-none">
                                        {[...Array(10)].map((_, i) => (
                                            <div
                                                key={i}
                                                className="absolute text-2xl animate-bounce"
                                                style={{
                                                    left: `${Math.random() * 100}%`,
                                                    top: `${Math.random() * 100}%`,
                                                    animationDelay: `${Math.random() * 2}s`,
                                                    animationDuration: `${2 + Math.random() * 2}s`,
                                                }}
                                            >
                                                {['🎊', '✨', '💫', '🌟', '🎈'][Math.floor(Math.random() * 5)]}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Messages Stream */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10 space-y-6 sm:space-y-8 lg:space-y-10 custom-scrollbar">
                            {(currentChat === "group"
                                ? messages
                                : privateMessages[currentChat] || []
                            )
                                .filter(
                                    (msg) =>
                                        !searchTerm ||
                                        msg.text?.toLowerCase().includes(searchTerm.toLowerCase())
                                )
                                .map((msg, i) => {
                                    const isMe = msg.userId === user.uid;
                                    const senderName =
                                        userNames[msg.userId] || `User ${msg.userId?.slice(-4)}`;
                                    return (
                                        <div
                                            key={msg.id || i}
                                            className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                                        >
                                            <div className="group relative max-w-[85%] sm:max-w-[70%] lg:max-w-[60%] transition-all">
                                                {!isMe && (
                                                    <div className="flex items-center gap-2 mb-2 ml-1">
                                                        {userAvatars[msg.userId]?.startsWith("http") ? (
                                                            <img
                                                                src={userAvatars[msg.userId]}
                                                                alt="Avatar"
                                                                className="w-6 h-6 rounded-full border border-zinc-600 object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full border border-zinc-600 bg-blue-600 flex items-center justify-center text-xs">
                                                                {userAvatars[msg.userId] || "👤"}
                                                            </div>
                                                        )}

                                                        <span className="text-[9px] font-black text-zinc-600 uppercase tracking-tighter truncate max-w-[120px] sm:max-w-[200px]">
                                                            {senderName}
                                                        </span>
                                                        <button
                                                            onClick={() =>
                                                                sendConnectRequest(user.uid, msg.userId, decodedTopic)
                                                            }
                                                            disabled={
                                                                connectionStatuses[msg.userId] === "pending" ||
                                                                connectionStatuses[msg.userId] === "accepted"
                                                            }
                                                            className="hidden sm:inline opacity-0 group-hover:opacity-100 px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 rounded text-[8px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {connectionStatuses[msg.userId] === "accepted"
                                                                ? "Connected"
                                                                : connectionStatuses[msg.userId] === "pending"
                                                                    ? "Pending"
                                                                    : "Connect"}
                                                        </button>
                                                    </div>
                                                )}

                                                {msg.replyTo && (
                                                    <div
                                                        className={`mb-2 px-3 py-2 rounded-lg border-l-2 ${theme === "dark"
                                                            ? "bg-zinc-800/50 border-zinc-600"
                                                            : "bg-gray-200/50 border-gray-400"
                                                            } ml-2`}
                                                    >
                                                        <div className="text-[10px] sm:text-xs text-zinc-500 mb-1">
                                                            Replying to{" "}
                                                            {userNames[msg.replyTo.userId] ||
                                                                `User ${msg.replyTo.userId?.slice(-4)}`}
                                                        </div>
                                                        <div className="text-xs sm:text-sm text-zinc-400 truncate">
                                                            {msg.replyTo.text}
                                                        </div>
                                                    </div>
                                                )}
                                                <div
                                                    className={`px-4 sm:px-5 lg:px-6 py-3 sm:py-4 rounded-3xl text-[13px] sm:text-[14px] font-medium leading-relaxed shadow-sm transition-all ${isMe
                                                        ? "bg-blue-600 text-white rounded-tr-none hover:shadow-[0_10px_40px_rgba(59,130,246,0.15)]"
                                                        : "bg-zinc-900/50 text-zinc-200 rounded-tl-none border border-zinc-800/50 hover:bg-zinc-900 transition-colors"
                                                        }`}
                                                >
                                                    {msg.text}
                                                </div>
                                                <div
                                                    className={`mt-1 sm:mt-2 flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300 ${isMe ? "justify-end" : "justify-start"
                                                        }`}
                                                >
                                                    <span className="text-[8px] sm:text-[9px] font-bold text-zinc-600 uppercase">
                                                        {msg.createdAt?.toDate
                                                            ? new Date(
                                                                msg.createdAt.toDate()
                                                            ).toLocaleTimeString([], {
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            })
                                                            : "Delivered"}
                                                    </span>
                                                    {msg.createdAt?.toDate && (
                                                        <span className="text-[8px] text-orange-400/70 font-medium">
                                                            {(() => {
                                                                const createdTime = msg
                                                                    .createdAt!.toDate()
                                                                    .getTime();
                                                                const expiryTime =
                                                                    createdTime + 2 * 60 * 60 * 1000;
                                                                const timeLeft = Math.max(
                                                                    0,
                                                                    expiryTime - Date.now()
                                                                );
                                                                return (
                                                                    "Expires in " +
                                                                    Math.floor(
                                                                        timeLeft / (1000 * 60)
                                                                    ) +
                                                                    "m"
                                                                );
                                                            })()}
                                                        </span>
                                                    )}
                                                    {isMe && (
                                                        <span className="text-[8px] text-zinc-500">
                                                            {msg.readBy && msg.readBy.length > 0
                                                                ? `Read by ${msg.readBy.length}`
                                                                : "Sent"}
                                                        </span>
                                                    )}
                                                    <button
                                                        onClick={() => setReplyingTo(msg)}
                                                        className="text-zinc-500 hover:text-blue-400 transition-colors p-1 hover:bg-blue-500/10 rounded"
                                                        title="Reply to message"
                                                    >
                                                        <Reply size={12} />
                                                    </button>
                                                    {isMe && msg.id && (
                                                        <button
                                                            onClick={() => handleDeleteMessage(msg.id)}
                                                            className="text-zinc-500 hover:text-red-400 transition-colors p-1 hover:bg-red-500/10 rounded"
                                                            title="Delete message"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    )}
                                                </div>

                                                {isMe && (
                                                    <div className="flex items-center justify-end gap-1 sm:gap-2 mt-1 sm:mt-2 mr-1">
                                                        <span className="text-[8px] sm:text-[9px] font-black text-zinc-600 uppercase tracking-tighter">
                                                            You
                                                        </span>
                                                        {userAvatars[user.uid]?.startsWith("http") ? (
                                                            <img
                                                                src={userAvatars[user.uid]}
                                                                alt="Your Avatar"
                                                                className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-zinc-600 object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-zinc-600 bg-blue-600 flex items-center justify-center text-xs">
                                                                {userAvatars[user.uid] || "👤"}
                                                            </div>
                                                        )}

                                                    </div>
                                                )}

                                                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                                    <div
                                                        className={`mt-1 sm:mt-2 flex flex-wrap gap-1 ${isMe ? "justify-end" : "justify-start"
                                                            }`}
                                                    >
                                                        {Object.entries(msg.reactions).map(
                                                            ([emoji, users]: [string, any]) => (
                                                                <button
                                                                    key={emoji}
                                                                    onClick={() => {
                                                                        if (users.includes(user?.uid)) {
                                                                            handleRemoveReaction(msg.id, emoji);
                                                                        } else {
                                                                            handleAddReaction(msg.id, emoji);
                                                                        }
                                                                    }}
                                                                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] sm:text-xs border transition-all ${users.includes(user?.uid)
                                                                        ? "bg-blue-600/20 border-blue-500/50 text-blue-300"
                                                                        : "bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:bg-zinc-700/50"
                                                                        }`}
                                                                    title={`${users.length} reaction${users.length > 1 ? "s" : ""
                                                                        }`}
                                                                >
                                                                    <span>{emoji}</span>
                                                                    <span className="text-[9px]">
                                                                        {users.length}
                                                                    </span>
                                                                </button>
                                                            )
                                                        )}
                                                    </div>
                                                )}

                                                <div
                                                    className={`mt-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity ${isMe ? "text-right" : "text-left"
                                                        }`}
                                                >
                                                    <button
                                                        onClick={() => {
                                                            const emoji = prompt("Enter emoji reaction:");
                                                            if (emoji && msg.id) {
                                                                handleAddReaction(msg.id, emoji);
                                                            }
                                                        }}
                                                        className="text-[10px] sm:text-xs text-zinc-500 hover:text-blue-400 transition-colors p-1 hover:bg-blue-500/10 rounded"
                                                        title="Add reaction"
                                                    >
                                                        + 😀
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            <div ref={bottomRef} />
                        </div>

                        {/* Input Terminal */}
                        <footer className="p-4 sm:p-6 lg:p-10">
                            <div className="max-w-4xl mx-auto relative">
                                {Object.keys(typingUsers).length > 0 && (
                                    <div className="mb-2 sm:mb-3 flex items-center gap-2 text-zinc-400 text-[10px] sm:text-xs">
                                        <div className="flex gap-1">
                                            <div
                                                className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                                                style={{ animationDelay: "0ms" }}
                                            />
                                            <div
                                                className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                                                style={{ animationDelay: "150ms" }}
                                            />
                                            <div
                                                className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                                                style={{ animationDelay: "300ms" }}
                                            />
                                        </div>
                                        <span className="font-medium truncate">
                                            {Object.values(typingUsers).join(", ")}{" "}
                                            {Object.keys(typingUsers).length === 1 ? "is" : "are"} typing...
                                        </span>
                                    </div>
                                )}

                                {replyingTo && (
                                    <div className="mb-2 sm:mb-3 p-3 bg-blue-600/10 border border-blue-500/30 rounded-xl">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Reply size={14} className="text-blue-400" />
                                                <span className="text-[10px] sm:text-xs font-bold text-blue-400 uppercase">
                                                    Replying to
                                                </span>
                                                <span className="text-[10px] sm:text-xs text-blue-300">
                                                    {userNames[replyingTo.userId] ||
                                                        `User ${replyingTo.userId?.slice(-4)}`}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => setReplyingTo(null)}
                                                className="text-zinc-500 hover:text-zinc-300"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                        <div className="text-xs sm:text-sm text-zinc-300 truncate">
                                            {replyingTo.text}
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 sm:gap-3 bg-zinc-900/40 border border-zinc-800/80 p-2 sm:p-3 rounded-2xl sm:rounded-[2rem] focus-within:border-blue-600/50 transition-all backdrop-blur-xl focus-within:shadow-[0_0_50px_rgba(59,130,246,0.05)]">
                                    <input
                                        className="flex-1 bg-transparent px-3 sm:px-5 py-2 sm:py-3 outline-none text-xs sm:text-sm placeholder:text-zinc-700 placeholder:uppercase placeholder:text-[9px] sm:placeholder:text-[10px] placeholder:tracking-[0.25em] sm:placeholder:tracking-[0.3em] font-bold text-white"
                                        value={input}
                                        onChange={(e) => handleInputChange(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                        placeholder="Transmit data..."
                                    />
                                    <button
                                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                        className="text-zinc-400 hover:text-zinc-200 transition-colors p-1 sm:p-2"
                                    >
                                        <Smile size={18} className="sm:w-5 sm:h-5" />
                                    </button>
                                    <button
                                        onClick={handleSend}
                                        disabled={!input.trim()}
                                        className="bg-white text-black h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center rounded-full hover:bg-blue-600 hover:text-white disabled:opacity-5 transition-all group active:scale-90 shadow-2xl"
                                    >
                                        <Send
                                            size={18}
                                            className="sm:w-5 sm:h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"
                                        />
                                    </button>
                                    {showEmojiPicker && (
                                        <div className="absolute bottom-full right-0 mb-2 z-50 scale-90 sm:scale-100 origin-bottom-right">
                                            <EmojiPicker onEmojiClick={handleEmojiClick} width={260} height={360} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </footer>
                    </main>

                    {/* Mobile Sidebar */}
                    <div
                        className={`fixed inset-0 z-50 sm:hidden ${isMobileMenuOpen ? "block" : "hidden"
                            }`}
                    >
                        <div
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                            onClick={() => setIsMobileMenuOpen(false)}
                        />
                        <div
                            className={`absolute right-0 top-0 h-full w-72 bg-[#050505] border-l border-white/10 transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
                                }`}
                        >
                            <div className="flex flex-col h-full p-5">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2">
                                        <Zap className="text-blue-500" fill="currentColor" size={20} />
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

                                {/* USER CARD + EXIT ONLY */}
                                <div className="mb-6">
                                    {user ? (
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
                                                onClick={() => {
                                                    setIsMobileMenuOpen(false);
                                                    router.push("/");
                                                }}
                                                className="w-full flex items-center gap-3 p-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-all"
                                            >
                                                <LogOut size={16} className="text-red-400" />
                                                <span className="text-sm font-medium text-red-400">
                                                    Exit Room
                                                </span>
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => router.push("/")}
                                            className="w-full flex items-center gap-3 p-4 bg-blue-600 hover:bg-blue-700 rounded-xl transition-all"
                                        >
                                            <Shield size={16} />
                                            <span className="text-sm font-medium">Secure Auth</span>
                                        </button>
                                    )}
                                </div>

                                {/* NAVIGATION */}
                                <div className="flex-1 space-y-2 overflow-y-auto">
                                    <div className="text-xs font-black uppercase tracking-widest text-zinc-600 mb-2">
                                        Navigation
                                    </div>

                                    <button
                                        onClick={() => {
                                            setIsMobileMenuOpen(false);
                                            setCurrentChat("group");
                                        }}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${currentChat === "group"
                                            ? "bg-blue-600/20 border border-blue-500/30"
                                            : "hover:bg-zinc-900/50"
                                            }`}
                                    >
                                        <Radio
                                            size={16}
                                            className={
                                                currentChat === "group" ? "text-blue-400" : "text-zinc-400"
                                            }
                                        />
                                        <span className="text-sm font-medium">Public Chat</span>
                                    </button>

                                    {privateRooms.length > 0 && (
                                        <div className="space-y-1">
                                            <div className="text-xs font-black uppercase tracking-widest text-zinc-600 mb-1">
                                                Private Chats
                                            </div>
                                            {privateRooms.map((room) => {
                                                const otherUserId =
                                                    room.userA === user?.uid ? room.userB : room.userA;
                                                const otherUserName =
                                                    userNames[otherUserId] ||
                                                    `User ${otherUserId?.slice(-4)}`;

                                                return (
                                                    <button
                                                        key={room.id}
                                                        onClick={() => {
                                                            setIsMobileMenuOpen(false);
                                                            setCurrentChat(room.id);
                                                        }}
                                                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${currentChat === room.id
                                                            ? "bg-purple-600/20 border border-purple-500/30"
                                                            : "hover:bg-zinc-900/50"
                                                            }`}
                                                    >
                                                        <MessageCircle
                                                            size={16}
                                                            className={
                                                                currentChat === room.id
                                                                    ? "text-purple-400"
                                                                    : "text-zinc-400"
                                                            }
                                                        />
                                                        <span className="text-sm font-medium truncate">
                                                            {otherUserName}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <button
                                        onClick={() => {
                                            setIsMobileMenuOpen(false);
                                            router.push("/");
                                        }}
                                        className="w-full flex items-center gap-3 p-3 hover:bg-zinc-900/50 rounded-xl transition-all text-left"
                                    >
                                        <House size={16} className="text-zinc-400" />
                                        <span className="text-sm font-medium">Home</span>
                                    </button>

                                    {/* ❌ NO SETTINGS HERE ANYMORE */}
                                </div>

                                <div className="border-t border-white/10 pt-4 space-y-2">
                                    <div className="text-center space-y-1">
                                        <div className="text-[7px] font-black uppercase tracking-[0.35em] text-zinc-700">
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
                </div>
            </div>


            {/* Settings Modal */}
            {showSettingsModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={() => setShowSettingsModal(false)}
                    />
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
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-2">
                                    Display Name
                                </label>
                                <input
                                    type="text"
                                    value={settingsTempDisplayName}
                                    onChange={(e) => setSettingsTempDisplayName(e.target.value)}
                                    className="w-full bg-zinc-900/50 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                                    placeholder="Enter your display name"
                                    maxLength={30}
                                />
                            </div>

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
                                            className={`aspect-square rounded-xl border-2 text-2xl flex items-center justify-center transition-all ${selectedAvatar === emoji
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

                            <div className="border-t border-zinc-800 pt-4">
                                <p className="text-sm font-medium text-zinc-400 mb-3">Preview</p>
                                <div className="flex items-center gap-3 p-3 bg-zinc-900/30 rounded-xl">
                                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-lg">
                                        {selectedAvatar || "👤"}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-white">
                                            {settingsTempDisplayName || "Anonymous"}
                                        </p>
                                        <p className="text-xs text-zinc-500">Your new profile</p>
                                    </div>
                                </div>
                            </div>

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
        </>
    );
}
