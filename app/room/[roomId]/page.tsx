"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { getRoom, getUserData, updateUserDisplayName } from "@/lib/firestore";
import { sendMessageToRoom, listenToRoomMessages, addReactionToMessage, removeReactionFromMessage } from "@/lib/messages";
import { 
    sendConnectRequest, 
    listenIncomingRequests, 
    acceptRequest, 
    rejectRequest, 
    listenAcceptedRequests, 
    listenSentRequests 
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
import { Send, Users, ChevronLeft, ShieldCheck, UserCheck, Clock, Hash, Zap, Radio, Smile, Trash2, Search, X, Sun, Moon, Reply, Shield, Lock, Trash } from "lucide-react";
import EmojiPicker from 'emoji-picker-react';

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
    const [privateMessages, setPrivateMessages] = useState<{[roomId: string]: any[]}>({});
    const [roomData, setRoomData] = useState<any>(null);
    const [roomLoading, setRoomLoading] = useState(true);
    const [userNames, setUserNames] = useState<{[uid: string]: string}>({});
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempDisplayName, setTempDisplayName] = useState("");
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [connectionStatuses, setConnectionStatuses] = useState<{[userId: string]: 'none' | 'pending' | 'accepted' | 'rejected'}>({});
    const [typingUsers, setTypingUsers] = useState<{[userId: string]: string}>({});
    const [isTyping, setIsTyping] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [showSearch, setShowSearch] = useState(false);
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');
    const [replyingTo, setReplyingTo] = useState<any>(null);
    const [encryptionEnabled, setEncryptionEnabled] = useState(false);
    const [userAvatars, setUserAvatars] = useState<{[uid: string]: string}>({});

    const bottomRef = useRef<HTMLDivElement | null>(null);

    // LOGIC: Unchanged (As requested)
    useEffect(() => {
        if (!roomId) return;
        getRoom(roomId as string).then((room) => {
            setRoomData(room);
            setRoomLoading(false);
        }).catch(() => setRoomLoading(false));
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
                if (reqs.length > 0 && reqs[0].privateRoomId) setCurrentChat(reqs[0].privateRoomId);
            })
        ];
        joinRoomPresence(roomId as string, user.uid);
        const hb = setInterval(() => heartbeatPresence(roomId as string, user.uid), 5000);
        return () => {
            unsubs.forEach(unsub => unsub());
            leaveRoomPresence(roomId as string, user.uid);
            clearInterval(hb);
        };
    }, [roomId, user]);

    useEffect(() => {
        const unsubs = privateRooms.map(room => 
            listenPrivateMessages(room.id, (msgs) => {
                setPrivateMessages(prev => ({ ...prev, [room.id]: msgs }));
            })
        );
        return () => unsubs.forEach(unsub => unsub());
    }, [privateRooms]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, privateMessages, currentChat]);

    // Load user display names for all active users
    useEffect(() => {
        const loadUserNames = async () => {
            const names: {[uid: string]: string} = {};
            const avatars: {[uid: string]: string} = {};
            
            for (const activeUser of activeUsers) {
                if (activeUser.userId && activeUser.userId !== user?.uid) {
                    try {
                        const userData = await getUserData(activeUser.userId);
                        if (userData?.customDisplayName) {
                            names[activeUser.userId] = userData.customDisplayName;
                        } else {
                            // Generate a friendly name if no custom name is set
                            names[activeUser.userId] = `User ${activeUser.userId.slice(-4)}`;
                        }
                        
                        // Generate avatar
                        if (userData?.customAvatar) {
                            avatars[activeUser.userId] = userData.customAvatar;
                        } else {
                            // Generate random avatar based on user ID for consistency
                            avatars[activeUser.userId] = generateRandomAvatar(activeUser.userId);
                        }
                    } catch (error) {
                        // Removed console.error for security
                        names[activeUser.userId] = `User ${activeUser.userId.slice(-4)}`;
                        avatars[activeUser.userId] = generateRandomAvatar(activeUser.userId);
                    }
                }
            }
            
            // Also set avatar for current user
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
            
            setUserNames(prev => ({ ...prev, ...names }));
            setUserAvatars(prev => ({ ...prev, ...avatars }));
        };
        if (activeUsers.length > 0) {
            loadUserNames();
        }
    }, [activeUsers, user]);

    // Load connection statuses for all active users
    useEffect(() => {
        const loadConnectionStatuses = async () => {
            if (!user) return;
            const statuses: {[userId: string]: 'none' | 'pending' | 'accepted' | 'rejected'} = {};
            
            for (const activeUser of activeUsers) {
                if (!activeUser.userId || activeUser.userId === user.uid) continue;
                
                try {
                    // Check sent requests
                    const sentQuery = query(
                        collection(db, "connection_requests"),
                        where("fromUser", "==", user.uid),
                        where("toUser", "==", activeUser.userId)
                    );
                    const sentSnap = await getDocs(sentQuery);
                    
                    if (!sentSnap.empty) {
                        const request = sentSnap.docs[0].data();
                        statuses[activeUser.userId] = request.status as 'pending' | 'accepted' | 'rejected';
                        continue;
                    }
                    
                    // Check received requests
                    const receivedQuery = query(
                        collection(db, "connection_requests"),
                        where("fromUser", "==", activeUser.userId),
                        where("toUser", "==", user.uid)
                    );
                    const receivedSnap = await getDocs(receivedQuery);
                    
                    if (!receivedSnap.empty) {
                        const request = receivedSnap.docs[0].data();
                        statuses[activeUser.userId] = request.status as 'pending' | 'accepted' | 'rejected';
                    } else {
                        statuses[activeUser.userId] = 'none';
                    }
                } catch (error) {
                    // Removed console.error for security
                    statuses[activeUser.userId] = 'none';
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
        
        if (currentChat === "group") {
            await sendMessageToRoom(roomId as string, msgText, user.uid, "text", "never", replyData);
        } else {
            await sendPrivateMessage(currentChat, msgText, user.uid, "text", "never", replyData);
        }
    };

    const handleDeleteMessage = async (messageId: string) => {
        if (!user) return;

        try {
            if (currentChat === "group") {
                // Delete from messages collection (not subcollection)
                const messageRef = doc(db, "messages", messageId);
                await deleteDoc(messageRef);
            } else {
                // Delete from messages collection (private messages are also stored in main messages collection)
                const messageRef = doc(db, "messages", messageId);
                await deleteDoc(messageRef);
            }
        } catch (error) {
            console.error("Error deleting message:", error);
        }
    };

    const handleDeleteRoom = async () => {
        if (!user || !roomData) return;

        const confirmDelete = window.confirm(`Are you sure you want to delete the room "${decodedTopic}"? This action cannot be undone and all messages will be lost.`);

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
        const success = await updateUserDisplayName(user.uid, tempDisplayName.trim());
        if (success) {
            setUserNames(prev => ({ ...prev, [user.uid]: tempDisplayName.trim() }));
            setIsEditingName(false);
        }
    };

    const handleEmojiClick = (emojiData: any) => {
        setInput(prev => prev + emojiData.emoji);
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
        // In a real implementation, you'd send typing status to Firebase
        // For now, we'll just use local state
    };

    const handleTypingStop = () => {
        if (!isTyping) return;
        setIsTyping(false);
        // In a real implementation, you'd clear typing status from Firebase
    };

    const handleInputChange = (value: string) => {
        setInput(value);
        if (value.trim() && !isTyping) {
            handleTypingStart();
        } else if (!value.trim() && isTyping) {
            handleTypingStop();
        }
    };

    if (roomLoading) return (
        <div className="h-screen bg-[#050505] flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <div className="text-blue-500 font-mono text-[10px] uppercase tracking-[0.5em] animate-pulse">Establishing Secure Uplink...</div>
        </div>
    );

    if (!user) return (
        <div className="h-screen bg-black flex items-center justify-center">
            <div className="border border-red-900/50 bg-red-950/10 p-8 rounded-3xl text-center">
                <p className="text-red-500 font-mono text-xs uppercase tracking-widest">Authentication Required</p>
                <button onClick={() => router.push("/")} className="mt-4 text-white bg-red-600 px-6 py-2 rounded-xl text-xs font-bold uppercase">Go Back</button>
            </div>
        </div>
    );

    const decodedTopic = roomData?.topic ? decodeURIComponent(roomData.topic) : "General Chat";

    return (
        <div className={`flex h-screen ${theme === 'dark' ? 'bg-[#050505] text-zinc-300' : 'bg-gray-100 text-gray-800'} overflow-hidden transition-colors duration-300`}>
            {/* SIDEBAR - Ultra Modern Glassmorphism */}
            <aside className={`w-80 ${theme === 'dark' ? 'bg-black/40 border-zinc-800/50' : 'bg-white/80 border-gray-300/50'} flex flex-col z-30 backdrop-blur-2xl`}>
                <div className="p-8 border-b border-zinc-800/50 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-600 to-transparent opacity-50" />
                    <div className="flex items-center justify-between mb-6">
                        <button onClick={() => router.push("/")} className="flex items-center text-[9px] text-zinc-600 hover:text-white transition-all uppercase font-black tracking-[0.2em]">
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
                    <h1 className="text-2xl font-black text-white truncate tracking-tighter flex items-center gap-2">
                        <Hash className="text-blue-600" size={20} />
                        {decodedTopic.toUpperCase()}
                        {roomData?.isLocked && <Lock size={16} className="text-yellow-500" />}
                    </h1>
                    <div className="flex items-center gap-2 mt-3 bg-blue-600/5 w-fit px-3 py-1 rounded-full border border-blue-500/10">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_#3b82f6]" />
                        <p className="text-[10px] text-blue-400 uppercase tracking-widest font-black">{activeCount} Nodes Online</p>
                    </div>

                    {/* Display Name Editor */}
                    <div className="mt-6 p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-2xl">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-wider">Your Identity</h3>
                            {!isEditingName && (
                                <button
                                    onClick={() => {
                                        setTempDisplayName(userNames[user.uid] || user.displayName || "");
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
                                        if (e.key === 'Enter') handleSaveDisplayName();
                                        if (e.key === 'Escape') setIsEditingName(false);
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
                            <p className="text-sm text-white font-medium">
                                {userNames[user.uid] || user.displayName || "Anonymous Node"}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8 custom-scrollbar">
                    {/* Private Conversations */}
                    <section>
                        <h3 className="text-[10px] text-zinc-700 font-black uppercase tracking-[0.3em] mb-5 px-4 flex items-center gap-2">
                            <ShieldCheck size={14} className="text-zinc-500" /> Secure Sessions
                        </h3>
                        <div 
                            onClick={() => setCurrentChat("group")}
                            className={`group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all mb-2 border ${currentChat === "group" ? 'bg-white text-black border-white shadow-[0_10px_30px_rgba(255,255,255,0.05)]' : 'hover:bg-zinc-900/50 border-transparent text-zinc-500 hover:text-zinc-200'}`}
                        >
                            <div className="flex items-center gap-3">
                                <Radio size={18} className={currentChat === "group" ? "text-black" : "text-zinc-700 group-hover:text-blue-500"} />
                                <span className="text-xs font-black uppercase">Public Stream</span>
                            </div>
                            {currentChat === "group" && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
                        </div>
                        
                        {privateRooms.map(room => (
                            <div 
                                key={room.id} 
                                onClick={() => setCurrentChat(room.id)}
                                className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all mb-2 border ${currentChat === room.id ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' : 'hover:bg-zinc-900/50 border-transparent text-zinc-500 hover:text-zinc-200'}`}
                            >
                                <div className={`w-2 h-2 rounded-full ${currentChat === room.id ? 'bg-white animate-pulse' : 'bg-blue-600/40'}`} />
                                <span className="text-xs font-black uppercase tracking-tight">Node_{room.id.slice(-4)}</span>
                            </div>
                        ))}
                    </section>

                    {/* Peer Discovery */}
                    <section>
                        <h3 className="text-[10px] text-zinc-700 font-black uppercase tracking-[0.3em] mb-5 px-4 flex items-center gap-2">
                            <Zap size={14} className="text-zinc-500" /> Proximity
                        </h3>
                        {activeUsers.map(u => {
                            const alreadyConnected = privateRooms.find(r => r.userA === u.userId || r.userB === u.userId);
                            const connectionStatus = connectionStatuses[u.userId] || 'none';

                            return (
                                <div key={u.id} className="flex justify-between items-center p-4 group hover:bg-zinc-900/30 rounded-2xl transition-all border border-transparent hover:border-zinc-800/50 mb-1">
                                    <div className="flex flex-col">
                                        <span className={`text-xs font-black tracking-tight ${u.userId === user.uid ? 'text-blue-500' : 'text-zinc-400'}`}>
                                            {u.userId === user.uid ? "YOU (HOST)" : (userNames[u.userId] || `User ${u.userId.slice(-4)}`)}
                                        </span>
                                        <span className="text-[8px] text-zinc-600 font-bold uppercase">Active Now</span>
                                    </div>
                                    {u.userId !== user.uid && (
                                        alreadyConnected ? (
                                            <div className="bg-blue-600/10 p-2 rounded-lg text-blue-500">
                                                <UserCheck size={14} />
                                            </div>
                                        ) : connectionStatus === 'pending' ? (
                                            <span className="text-[9px] text-zinc-600 border border-zinc-800 px-3 py-1 rounded-full uppercase font-black">Waiting</span>
                                        ) : connectionStatus === 'accepted' ? (
                                            <div className="bg-green-600/10 p-2 rounded-lg text-green-500">
                                                <UserCheck size={14} />
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => sendConnectRequest(user.uid, u.userId, decodedTopic)} 
                                                className="text-[9px] bg-white text-black px-4 py-2 rounded-xl font-black uppercase transition-all hover:scale-105 active:scale-95 shadow-lg shadow-white/5"
                                            >
                                                Connect
                                            </button>
                                        )
                                    )}
                                </div>
                            );
                        })}
                    </section>
                </div>
            </aside>

            {/* CHAT MAIN AREA - Clean & Focused */}
            <main className={`flex-1 flex flex-col relative ${theme === 'dark' ? 'bg-[#050505]' : 'bg-gray-50'}`}>
                <header className="h-20 border-b border-zinc-900 flex items-center px-10 justify-between bg-black/20 backdrop-blur-md z-20">
                    <div className="flex flex-col">
                        <h2 className="text-[11px] font-black tracking-[0.4em] uppercase text-zinc-500">
                            {currentChat === "group" ? "Signal: Global_Broadcast" : "Signal: Peer_To_Peer_Encrypted"}
                        </h2>
                        <p className="text-[9px] text-blue-600 font-bold uppercase tracking-widest mt-0.5">
                            Latency: 2ms • Security: {encryptionEnabled ? 'E2E Encrypted' : 'High'}
                        </p>
                    </div>
                    <div className="flex -space-x-2">
                        {[1,2,3].map(i => (
                            <div key={i} className="w-8 h-8 rounded-full border-2 border-[#050505] bg-zinc-800" />
                        ))}
                        <button
                            onClick={() => setShowSearch(!showSearch)}
                            className="w-8 h-8 rounded-full border-2 border-zinc-700/50 bg-zinc-800/50 hover:bg-zinc-700/50 flex items-center justify-center transition-all ml-2"
                            title="Search messages"
                        >
                            <Search size={14} className="text-zinc-400" />
                        </button>
                        <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="w-8 h-8 rounded-full border-2 border-zinc-700/50 bg-zinc-800/50 hover:bg-zinc-700/50 flex items-center justify-center transition-all ml-2"
                            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                        >
                            {theme === 'dark' ? <Sun size={14} className="text-zinc-400" /> : <Moon size={14} className="text-zinc-400" />}
                        </button>
                        <button
                            onClick={() => setEncryptionEnabled(!encryptionEnabled)}
                            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ml-2 ${
                                encryptionEnabled 
                                    ? 'border-green-500/50 bg-green-900/20' 
                                    : 'border-zinc-700/50 bg-zinc-800/50 hover:bg-zinc-700/50'
                            }`}
                            title={`${encryptionEnabled ? 'Disable' : 'Enable'} end-to-end encryption`}
                        >
                            <Shield size={14} className={encryptionEnabled ? 'text-green-400' : 'text-zinc-400'} />
                        </button>
                    </div>
                </header>

                {/* Notifications - Fixed Logic Position */}
                {incomingRequests.length > 0 && (
                    <div className="absolute top-24 left-1/2 -translate-x-1/2 w-full max-w-sm z-40 px-4">
                        {incomingRequests.map(req => (
                            <div key={req.id} className="bg-zinc-900/90 border border-blue-600/30 p-5 rounded-3xl shadow-2xl backdrop-blur-xl flex flex-col gap-4 animate-in slide-in-from-top-10 duration-500">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-600 rounded-xl">
                                        <Zap size={16} className="text-white" />
                                    </div>
                                    <p className="text-[11px] font-black uppercase text-white leading-none">Incoming Handshake</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => acceptRequest(req.id)} className="flex-1 bg-white text-black text-[10px] py-2.5 rounded-xl font-black uppercase hover:bg-blue-600 hover:text-white transition-all">Accept</button>
                                    <button onClick={() => rejectRequest(req.id)} className="flex-1 bg-zinc-800 text-zinc-400 text-[10px] py-2.5 rounded-xl font-black uppercase hover:bg-zinc-700 transition-all">Ignore</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Search Bar */}
                {showSearch && (
                    <div className="px-10 py-4 bg-zinc-900/50 border-b border-zinc-800/50">
                        <div className="max-w-4xl mx-auto relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search messages..."
                                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg pl-10 pr-24 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50"
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm("")}
                                        className="px-2 py-1 text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 hover:text-red-300 rounded font-medium transition-colors"
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
                                    className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 hover:text-white rounded font-medium transition-colors"
                                    title="Close search"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                        {searchTerm && (
                            <div className="max-w-4xl mx-auto mt-2 text-xs text-zinc-500">
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

                {/* Messages Stream - Smooth & Spaced */}
                <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                    {(currentChat === "group" ? messages : (privateMessages[currentChat] || []))
                        .filter(msg => !searchTerm || msg.text?.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map((msg, i) => {
                        const isMe = msg.userId === user.uid;
                        const senderName = userNames[msg.userId] || `User ${msg.userId?.slice(-4)}`;
                        return (
                            <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`group relative max-w-[60%] transition-all`}>
                                    {!isMe && (
                                        <div className="flex items-center gap-2 mb-2 ml-1">
                                            <img 
                                                src={userAvatars[msg.userId] || generateRandomAvatar(msg.userId)} 
                                                alt="Avatar" 
                                                className="w-6 h-6 rounded-full border border-zinc-600"
                                            />
                                            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-tighter">
                                                {senderName}
                                            </span>
                                            <button
                                                onClick={() => sendConnectRequest(user.uid, msg.userId, decodedTopic)}
                                                disabled={connectionStatuses[msg.userId] === 'pending' || connectionStatuses[msg.userId] === 'accepted'}
                                                className="opacity-0 group-hover:opacity-100 px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 rounded text-[8px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {connectionStatuses[msg.userId] === 'accepted' ? 'Connected' : connectionStatuses[msg.userId] === 'pending' ? 'Pending' : 'Connect'}
                                            </button>
                                        </div>
                                    )}
                                    
                                    {/* Reply Context */}
                                    {msg.replyTo && (
                                        <div className={`mb-2 px-3 py-2 rounded-lg border-l-2 ${theme === 'dark' ? 'bg-zinc-800/50 border-zinc-600' : 'bg-gray-200/50 border-gray-400'} ml-2`}>
                                            <div className="text-xs text-zinc-500 mb-1">
                                                Replying to {userNames[msg.replyTo.userId] || `User ${msg.replyTo.userId?.slice(-4)}`}
                                            </div>
                                            <div className="text-sm text-zinc-400 truncate">
                                                {msg.replyTo.text}
                                            </div>
                                        </div>
                                    )}
                                    <div className={`px-6 py-4 rounded-3xl text-[14px] font-medium leading-relaxed shadow-sm transition-all ${
                                        isMe 
                                        ? 'bg-blue-600 text-white rounded-tr-none hover:shadow-[0_10px_40px_rgba(59,130,246,0.15)]' 
                                        : 'bg-zinc-900/50 text-zinc-200 rounded-tl-none border border-zinc-800/50 hover:bg-zinc-900 transition-colors'
                                    }`}>
                                        {msg.text}
                                    </div>
                                    <div className={`mt-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <span className="text-[9px] font-bold text-zinc-600 uppercase">
                                            {msg.createdAt?.toDate ? new Date(msg.createdAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Delivered'}
                                        </span>
                                        {isMe && (
                                            <span className="text-[8px] text-zinc-500">
                                                {msg.readBy && msg.readBy.length > 0 ? `Read by ${msg.readBy.length}` : 'Sent'}
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
                                    
                                    {/* Current User Avatar */}
                                    {isMe && (
                                        <div className="flex items-center justify-end gap-2 mt-2 mr-1">
                                            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-tighter">
                                                You
                                            </span>
                                            <img 
                                                src={userAvatars[user.uid] || generateRandomAvatar(user.uid)} 
                                                alt="Your Avatar" 
                                                className="w-6 h-6 rounded-full border border-zinc-600"
                                            />
                                        </div>
                                    )}
                                    
                                    {/* Reactions */}
                                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                        <div className={`mt-2 flex flex-wrap gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            {Object.entries(msg.reactions).map(([emoji, users]: [string, any]) => (
                                                <button
                                                    key={emoji}
                                                    onClick={() => {
                                                        if (users.includes(user?.uid)) {
                                                            handleRemoveReaction(msg.id, emoji);
                                                        } else {
                                                            handleAddReaction(msg.id, emoji);
                                                        }
                                                    }}
                                                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition-all ${
                                                        users.includes(user?.uid)
                                                            ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                                                            : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:bg-zinc-700/50'
                                                    }`}
                                                    title={`${users.length} reaction${users.length > 1 ? 's' : ''}`}
                                                >
                                                    <span>{emoji}</span>
                                                    <span className="text-[10px]">{users.length}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    
                                    {/* Add Reaction Button */}
                                    <div className={`mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? 'text-right' : 'text-left'}`}>
                                        <button
                                            onClick={() => {
                                                const emoji = prompt("Enter emoji reaction:");
                                                if (emoji && msg.id) {
                                                    handleAddReaction(msg.id, emoji);
                                                }
                                            }}
                                            className="text-zinc-500 hover:text-blue-400 transition-colors p-1 hover:bg-blue-500/10 rounded text-xs"
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

                {/* Input Terminal - Cyber Design */}
                <footer className="p-10">
                    <div className="max-w-4xl mx-auto relative">
                        {/* Typing Indicators */}
                        {Object.keys(typingUsers).length > 0 && (
                            <div className="mb-3 flex items-center gap-2 text-zinc-400 text-xs">
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                                </div>
                                <span className="font-medium">
                                    {Object.values(typingUsers).join(', ')} {Object.keys(typingUsers).length === 1 ? 'is' : 'are'} typing...
                                </span>
                            </div>
                        )}
                        
                        {/* Reply Indicator */}
                        {replyingTo && (
                            <div className="mb-3 p-3 bg-blue-600/10 border border-blue-500/30 rounded-xl">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Reply size={14} className="text-blue-400" />
                                        <span className="text-xs font-bold text-blue-400 uppercase">Replying to</span>
                                        <span className="text-xs text-blue-300">
                                            {userNames[replyingTo.userId] || `User ${replyingTo.userId?.slice(-4)}`}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => setReplyingTo(null)}
                                        className="text-zinc-500 hover:text-zinc-300"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                                <div className="text-sm text-zinc-300 truncate">
                                    {replyingTo.text}
                                </div>
                            </div>
                        )}
                        
                        <div className="flex items-center gap-4 bg-zinc-900/40 border border-zinc-800/80 p-3 rounded-[2rem] focus-within:border-blue-600/50 transition-all backdrop-blur-xl focus-within:shadow-[0_0_50px_rgba(59,130,246,0.05)]">
                            <input 
                                className="flex-1 bg-transparent px-6 py-3 outline-none text-sm placeholder:text-zinc-700 placeholder:uppercase placeholder:text-[10px] placeholder:tracking-[0.3em] font-bold text-white" 
                                value={input} 
                                onChange={(e) => handleInputChange(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                placeholder="Transmit data..."
                            />
                            <button 
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                className="text-zinc-400 hover:text-zinc-200 transition-colors p-2"
                            >
                                <Smile size={20} />
                            </button>
                            <button 
                                onClick={handleSend}
                                disabled={!input.trim()}
                                className="bg-white text-black h-12 w-12 flex items-center justify-center rounded-full hover:bg-blue-600 hover:text-white disabled:opacity-5 transition-all group active:scale-90 shadow-2xl"
                            >
                                <Send size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                            </button>
                        </div>
                        {showEmojiPicker && (
                            <div className="absolute bottom-full right-0 mb-2 z-50">
                                <EmojiPicker 
                                    onEmojiClick={handleEmojiClick}
                                    width={300}
                                    height={400}
                                />
                            </div>
                        )}
                    </div>
                </footer>
            </main>
        </div>
    );
}