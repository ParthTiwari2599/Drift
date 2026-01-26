"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { sendPrivateMessage, listenPrivateMessages } from "@/lib/privateMessages";
import { updateUserDisplayName } from "@/lib/privateRooms";
import { getUserData } from "@/lib/firestore";
import { doc, getDoc, onSnapshot, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Send, ChevronLeft, ShieldCheck, Lock, Cpu, Zap, Settings, Smile, Trash2 } from "lucide-react";
import EmojiPicker from 'emoji-picker-react';

export default function PrivateRoomPage() {
    const { roomId } = useParams();
    const router = useRouter();
    const { user, loading } = useAuth();

    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<any[]>([]);
    const [roomData, setRoomData] = useState<any>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [editingName, setEditingName] = useState<string | null>(null);
    const [tempName, setTempName] = useState("");
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [userNames, setUserNames] = useState<{[uid: string]: string}>({});
    const bottomRef = useRef<HTMLDivElement | null>(null);

    // LOGIC: Unchanged
    useEffect(() => {
        if (!roomId) return;
        const unsub = listenPrivateMessages(roomId as string, setMessages);
        return () => unsub();
    }, [roomId]);

    useEffect(() => {
        if (!roomId) return;
        const unsub = onSnapshot(doc(db, "private_rooms", roomId as string), (snap) => {
            if (snap.exists()) setRoomData(snap.data());
        });
        return unsub;
    }, [roomId]);

    // Load user display names from Firebase
    useEffect(() => {
        const loadUserNames = async () => {
            if (!roomData?.userA || !roomData?.userB) return;
            
            const names: {[uid: string]: string} = {};
            const userIds = [roomData.userA, roomData.userB];
            
            for (const userId of userIds) {
                try {
                    const userData = await getUserData(userId);
                    if (userData?.customDisplayName) {
                        names[userId] = userData.customDisplayName;
                    }
                } catch (error) {
                    console.error("Error loading user data for", userId, error);
                }
            }
            
            setUserNames(names);
        };
        
        if (roomData) {
            loadUserNames();
        }
    }, [roomData]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || !user || !roomId) return;
        await sendPrivateMessage(roomId as string, input, user.uid);
        setInput("");
    };

    const handleDeleteMessage = async (messageId: string) => {
        if (!roomId) return;
        try {
            // Delete from messages collection (private messages are also stored in main messages collection)
            await deleteDoc(doc(db, "messages", messageId));
        } catch (error) {
            console.error("Error deleting message:", error);
        }
    };

    const handleEmojiClick = (emojiData: any) => {
        setInput(prev => prev + emojiData.emoji);
        setShowEmojiPicker(false);
    };

    if (loading) return (
        <div className="h-screen bg-[#050505] flex flex-col items-center justify-center space-y-4">
            <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <div className="text-blue-500 font-mono text-[10px] uppercase tracking-[0.4em] animate-pulse">Decrypting Session...</div>
        </div>
    );

    return (
        <div className="h-screen bg-[#050505] text-zinc-300 font-sans flex flex-col overflow-hidden">
            {/* Header - Glassmorphism */}
            <header className="h-20 border-b border-zinc-900 flex items-center px-6 md:px-10 justify-between bg-black/40 backdrop-blur-xl z-20">
                <div className="flex items-center gap-6">
                    <button 
                        onClick={() => router.back()} 
                        className="p-2 hover:bg-zinc-900 rounded-full transition-all group"
                    >
                        <ChevronLeft size={20} className="text-zinc-500 group-hover:text-white" />
                    </button>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <ShieldCheck size={16} className="text-blue-500" />
                            <h1 className="text-sm font-black text-white uppercase tracking-wider">
                                Secure_Node_{roomId?.slice(-4)}
                            </h1>
                        </div>
                        <p className="text-[9px] text-blue-600 font-black uppercase tracking-[0.2em] mt-0.5 flex items-center gap-1">
                            <Lock size={10} /> Point-to-Point Encryption Active
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="p-2 hover:bg-zinc-900 rounded-full transition-all group"
                        title="Edit Names"
                    >
                        <Settings size={16} className="text-zinc-500 group-hover:text-white" />
                    </button>
                    <div className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center gap-2">
                        <Cpu size={12} className="text-zinc-600" />
                        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Core: Stable</span>
                    </div>
                </div>
            </header>

            {/* Settings Panel */}
            {showSettings && roomData && (
                <div className="bg-zinc-900/90 border-b border-zinc-800 p-4 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-white">Edit Display Names</h3>
                        <button
                            onClick={() => setShowSettings(false)}
                            className="text-zinc-400 hover:text-white"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="space-y-3">
                        {[roomData.userA, roomData.userB].map((userId) => {
                            const currentName = roomData.userNames?.[userId] || `User ${userId === roomData.userA ? 'A' : 'B'}`;
                            const isEditing = editingName === userId;
                            return (
                                <div key={userId} className="flex items-center gap-3">
                                    <span className="text-xs text-zinc-400 w-16">
                                        {userId === user?.uid ? 'You' : 'Partner'}:
                                    </span>
                                    {isEditing ? (
                                        <>
                                            <input
                                                value={tempName}
                                                onChange={(e) => setTempName(e.target.value)}
                                                className="flex-1 px-3 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
                                                placeholder="Enter name..."
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        updateUserDisplayName(roomId as string, userId, tempName);
                                                        setEditingName(null);
                                                    } else if (e.key === 'Escape') {
                                                        setEditingName(null);
                                                    }
                                                }}
                                                autoFocus
                                            />
                                            <button
                                                onClick={() => {
                                                    updateUserDisplayName(roomId as string, userId, tempName);
                                                    setEditingName(null);
                                                }}
                                                className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => setEditingName(null)}
                                                className="px-3 py-1 bg-zinc-600 text-white text-xs rounded hover:bg-zinc-700 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <span className="flex-1 text-sm text-white">{currentName}</span>
                                            <button
                                                onClick={() => {
                                                    setEditingName(userId);
                                                    setTempName(currentName);
                                                }}
                                                className="px-3 py-1 bg-zinc-700 text-white text-xs rounded hover:bg-zinc-600 transition-colors"
                                            >
                                                Edit
                                            </button>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 custom-scrollbar bg-[radial-gradient(circle_at_50%_50%,rgba(10,10,10,1)_0%,rgba(0,0,0,1)_100%)]">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-20">
                        <Zap size={40} className="mb-4 text-zinc-500" />
                        <p className="text-[10px] font-black uppercase tracking-[0.5em]">No Signal Detected</p>
                    </div>
                )}
                
                {messages.map((msg, i) => {
                    const isMe = msg.userId === user?.uid;
                    const displayName = userNames[msg.userId] || (isMe ? 'You' : `User ${msg.userId?.slice(-4)}`);
                    return (
                        <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                            <div className={`max-w-[75%] md:max-w-[60%] group`}>
                                {!isMe && (
                                    <div className="mb-1 px-2">
                                        <span className="text-xs font-medium text-zinc-400">{displayName}</span>
                                    </div>
                                )}
                                <div className={`px-6 py-3.5 rounded-3xl text-[14px] font-medium leading-relaxed transition-all shadow-sm ${
                                    isMe 
                                    ? 'bg-blue-600 text-white rounded-tr-none hover:shadow-[0_10px_30px_rgba(59,130,246,0.2)]' 
                                    : 'bg-zinc-900 text-zinc-200 rounded-tl-none border border-zinc-800/50 hover:bg-zinc-800/80'
                                }`}>
                                    <p>{msg.text}</p>
                                </div>
                                <div className={`mt-2 flex items-center gap-2 opacity-0 group-hover:opacity-40 transition-opacity ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <span className="text-[8px] font-black uppercase tracking-tighter text-zinc-500">
                                        {msg.createdAt?.toDate ? new Date(msg.createdAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Verified'}
                                    </span>
                                    {/* Expiry Indicator */}
                                    {msg.createdAt?.toDate && (
                                        <span className="text-[7px] text-orange-400/60 font-medium">
                                            {(() => {
                                                const createdTime = msg.createdAt.toDate().getTime();
                                                const expiryTime = createdTime + 2 * 60 * 60 * 1000;
                                                const timeLeft = Math.max(0, expiryTime - Date.now());
                                                return Math.floor(timeLeft / (1000 * 60)) + 'm left';
                                            })()}
                                        </span>
                                    )}
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
                            </div>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            {/* Footer / Input Terminal */}
            <footer className="p-6 md:p-10 bg-gradient-to-t from-black to-transparent">
                <div className="max-w-4xl mx-auto relative flex items-center gap-4 bg-zinc-900/40 border border-zinc-800/80 p-2.5 rounded-[2rem] focus-within:border-blue-600/50 transition-all backdrop-blur-xl group shadow-2xl">
                    <input 
                        className="flex-1 bg-transparent px-6 py-3 outline-none text-sm placeholder:text-zinc-700 placeholder:uppercase placeholder:text-[10px] placeholder:tracking-[0.3em] font-bold text-white"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                        placeholder="Secure transmission..."
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
                        className="bg-white text-black h-12 w-12 flex items-center justify-center rounded-full hover:bg-blue-600 hover:text-white disabled:opacity-5 transition-all active:scale-95 shadow-xl group/btn"
                    >
                        <Send size={18} className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
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
            </footer>
        </div>
    );
}