"use client";

import { useParams, useRouter } from "next/navigation";
import { AppModal } from "@/components/AppModal";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { sendPrivateMessage, listenPrivateMessages } from "@/lib/privateMessages";
import { updateUserDisplayName } from "@/lib/privateRooms";
import { getUserData, updateUserData } from "@/lib/firestore";
import { doc, getDoc, onSnapshot, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Send, ChevronLeft, ShieldCheck, Lock, Cpu, Zap, Settings, Smile, Trash2, Menu, X, House, MessageCircle, User, LogOut, Shield, Mic, MicOff } from "lucide-react";
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
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [tempDisplayName, setTempDisplayName] = useState("");
    const [selectedAvatar, setSelectedAvatar] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const welcomeSentRef = useRef(false);

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

    // Send welcome message if chat is empty
    useEffect(() => {
        if (messages.length === 0 && user && roomId && roomData && !welcomeSentRef.current) {
            welcomeSentRef.current = true;
            const welcomeMessage = `🎉 Welcome to DRIFT Private Chat! 🎉

🚫 Please do NOT take anyone to Instagram or other platforms from here.
🌟 Enjoy this secure, ephemeral messaging experience.
📝 Give us feedback to improve DRIFT!

Your messages disappear after 2 hours for privacy. 💫`;

            // Send as system message
            sendPrivateMessage(roomId as string, welcomeMessage, "system", "text", "2h");
        }
    }, [messages.length, user, roomId, roomData]);

    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const handleSend = async () => {
        if (!input.trim() || !user || !roomId) return;

        const msgText = input;
        setInput("");

        try {
            await sendPrivateMessage(roomId as string, msgText, user.uid);
        } catch (error: any) {
            console.error("Failed to send private message:", error);

            // Show user-friendly error message
            const errorMessage = error.message?.includes("No internet connection")
                ? "No internet connection. Your message will be sent when connection is restored."
                : error.message?.includes("permission")
                ? "You don't have permission to send messages in this chat."
                : "Failed to send message. Please try again.";

            alert(errorMessage);

            // Restore the input if it was a network error
            if (error.message?.includes("No internet connection")) {
                setInput(msgText);
            }
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: 16000, // Lower sample rate for smaller files
                    channelCount: 1, // Mono audio
                    echoCancellation: true,
                    noiseSuppression: true,
                }
            });
            const recorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus', // More compressed format
            });
            setMediaRecorder(recorder);
            setRecordedChunks([]);

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    setRecordedChunks((prev) => [...prev, event.data]);
                }
            };

            recorder.onstop = async () => {
                const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
                await sendVoiceNote(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            recorder.start();
            setIsRecording(true);

            // Auto-stop after 30 seconds to prevent huge files
            setTimeout(() => {
                if (recorder.state === 'recording') {
                    recorder.stop();
                }
            }, 30000);
        } catch (error) {
            console.error('Error starting recording:', error);
            alert('Could not access microphone');
        }
    };

    const stopRecording = () => {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            setIsRecording(false);
        }
    };

    const sendVoiceNote = async (audioBlob: Blob) => {
        if (!user || !roomId) return;

        try {
            // Convert blob to base64 for storage
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64Audio = reader.result as string;
                setInput("");

                await sendPrivateMessage(roomId as string, base64Audio, user.uid, "voice");
            };
            reader.readAsDataURL(audioBlob);
        } catch (error) {
            console.error("Failed to send voice note:", error);
            alert("Failed to send voice note");
        }
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

    const handleSaveSettings = async () => {
        if (!user) return;
        
        try {
            await updateUserData(user.uid, {
                customDisplayName: tempDisplayName.trim() || undefined,
                customAvatar: selectedAvatar || undefined
            });
            
            // Update local state
            setUserNames(prev => ({
                ...prev,
                [user.uid]: tempDisplayName.trim() || `User ${user.uid.slice(-4)}`
            }));
            
            setShowSettingsModal(false);
        } catch (error) {
            console.error("Failed to update settings:", error);
        }
    };

    if (loading) return (
        <div className="h-screen bg-[#050505] flex flex-col items-center justify-center space-y-4">
            <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <div className="text-blue-500 font-mono text-[10px] uppercase tracking-[0.4em] animate-pulse">Decrypting Session...</div>
        </div>
    );

    if (!user || user.isAnonymous) return (
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

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="hidden sm:flex w-80 bg-black/40 border-r border-zinc-800/50 flex-col backdrop-blur-2xl">
                <div className="p-8 border-b border-zinc-800/50">
                    <div className="flex items-center justify-between mb-6">
                        <button 
                            onClick={() => router.back()} 
                            className="flex items-center text-[9px] text-zinc-600 hover:text-white transition-all uppercase font-black tracking-[0.2em]"
                        >
                            <ChevronLeft size={14} className="mr-1" /> Exit Protocol
                        </button>
                    </div>
                    
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-2">
                            <ShieldCheck size={16} className="text-blue-500" />
                            <h1 className="text-sm font-black text-white uppercase tracking-wider">
                                Secure_Node_{roomId?.slice(-4)}
                            </h1>
                        </div>
                        <p className="text-[9px] text-blue-600 font-bold uppercase tracking-widest">
                            Point-to-Point Encryption Active
                        </p>
                    </div>
                </div>

                {/* User Status */}
                <div className="p-8">
                    {user ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-3 bg-zinc-900/30 rounded-xl">
                                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                                    <User size={16} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-white">{user.displayName || 'Anonymous'}</p>
                                    <p className="text-xs text-zinc-500">Private Chat</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => router.back()}
                                className="w-full flex items-center gap-3 p-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-all"
                            >
                                <LogOut size={16} className="text-red-400" />
                                <span className="text-sm font-medium text-red-400">Exit Private Chat</span>
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

                {/* Settings Section */}
                <div className="mt-auto p-4 border-t border-zinc-800/50">
                    <button 
                        onClick={() => {
                            setTempDisplayName(userNames[user?.uid || ""] || user?.displayName || "");
                            setSelectedAvatar(""); // Will be loaded from user data
                            setShowSettingsModal(true);
                        }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-zinc-900/50 rounded-xl transition-all text-left"
                    >
                        <Settings size={16} className="text-zinc-400" />
                        <span className="text-sm font-medium">Settings</span>
                    </button>
                </div>
            </aside>

            <div className={`flex-1 h-screen bg-[#050505] text-zinc-300 font-sans flex flex-col overflow-hidden ${isMobileMenuOpen ? 'overflow-hidden' : ''}`}>
            {/* Header - Glassmorphism */}
            <header className="h-20 border-b border-zinc-900 flex items-center px-4 sm:px-6 md:px-10 justify-between bg-black/40 backdrop-blur-xl z-20">
                <div className="flex items-center gap-4 sm:gap-6">
                    {/* Mobile Hamburger Menu */}
                    <button 
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="sm:hidden p-2 hover:bg-zinc-900 rounded-lg transition-all"
                    >
                        {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                    
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

            {/* Mobile Sidebar */}
            <div className={`fixed inset-0 z-50 sm:hidden ${isMobileMenuOpen ? 'block' : 'hidden'}`}>
                {/* Backdrop */}
                <div 
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
                
                {/* Sidebar */}
                <div className={`absolute right-0 top-0 h-full w-80 bg-[#050505] border-l border-white/10 transform transition-transform duration-300 ease-in-out ${
                    isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
                }`}>
                    <div className="flex flex-col h-full p-6">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-2">
                                <Zap className="text-blue-500" fill="currentColor" size={20} />
                                <span className="text-lg font-black italic tracking-tighter">DRIFT.</span>
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
                            {user ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 p-3 bg-zinc-900/30 rounded-xl">
                                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                                            <User size={16} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-white">{user.displayName || 'Anonymous'}</p>
                                            <p className="text-xs text-zinc-500">Private Chat</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            setIsMobileMenuOpen(false);
                                            router.back();
                                        }}
                                        className="w-full flex items-center gap-3 p-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-all"
                                    >
                                        <LogOut size={16} className="text-red-400" />
                                        <span className="text-sm font-medium text-red-400">Exit Private Chat</span>
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setIsMobileMenuOpen(false);
                                            setTempDisplayName(userNames[user.uid] || user.displayName || "");
                                            setSelectedAvatar(""); // Will be loaded from user data
                                            setShowSettingsModal(true);
                                        }}
                                        className="w-full flex items-center gap-3 p-3 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-700/50 rounded-xl transition-all"
                                    >
                                        <Settings size={16} className="text-zinc-400" />
                                        <span className="text-sm font-medium text-zinc-300">Settings</span>
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

                        {/* Navigation Links */}
                        <div className="flex-1 space-y-2">
                            <div className="text-xs font-black uppercase tracking-widest text-zinc-600 mb-4">Navigation</div>
                            
                            <button 
                                onClick={() => {
                                    setIsMobileMenuOpen(false);
                                    router.push("/");
                                }}
                                className="w-full flex items-center gap-3 p-3 hover:bg-zinc-900/50 rounded-xl transition-all text-left"
                            >
                                <House size={16} className="text-blue-400" />
                                <span className="text-sm font-medium">Home</span>
                            </button>

                            <button 
                                onClick={() => {
                                    setIsMobileMenuOpen(false);
                                    // Go back to room selection or main room
                                    router.push("/");
                                }}
                                className="w-full flex items-center gap-3 p-3 hover:bg-zinc-900/50 rounded-xl transition-all text-left"
                            >
                                <MessageCircle size={16} className="text-green-400" />
                                <span className="text-sm font-medium">Public Rooms</span>
                            </button>

                            <button className="w-full flex items-center gap-3 p-3 hover:bg-zinc-900/50 rounded-xl transition-all text-left">
                                <Settings size={16} className="text-zinc-400" />
                                <span className="text-sm font-medium">Settings</span>
                            </button>
                        </div>

                        {/* Footer */}
                        <div className="border-t border-white/10 pt-6 space-y-3">
                            <div className="text-center space-y-2">
                                <div className="text-[8px] font-black uppercase tracking-[0.4em] text-zinc-700">DEVELOPED BY</div>
                                <div className="text-sm font-bold text-blue-400">Parth Tiwari</div>
                                <div className="text-[7px] text-zinc-500 font-medium">GitHub: @parthtiwari2599</div>
                                <div className="text-[7px] text-zinc-500 font-medium">parthtiwari2599@gmail.com</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

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
                    const isSystem = msg.userId === "system";
                    const displayName = userNames[msg.userId] || (isMe ? 'You' : `User ${msg.userId?.slice(-4)}`);
                    
                    if (isSystem) {
                        return (
                            <div key={msg.id || i} className="flex justify-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="max-w-[80%] bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-4 text-center">
                                    <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
                                        {msg.text}
                                    </div>
                                </div>
                            </div>
                        );
                    }
                    
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
                                    {msg.type === "voice" ? (
                                        <audio controls className="max-w-full h-8">
                                            <source src={msg.text} type="audio/webm" />
                                            Your browser does not support audio playback.
                                        </audio>
                                    ) : (
                                        <p>{msg.text}</p>
                                    )}
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
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`text-zinc-400 hover:text-red-400 transition-colors p-2 ${isRecording ? 'text-red-500 animate-pulse' : ''}`}
                        title={isRecording ? "Stop recording" : "Start voice recording"}
                    >
                        {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>
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
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Display Name</label>
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
                  <label className="block text-sm font-medium text-zinc-400 mb-3">Choose Avatar</label>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      '👤', '🎭', '🤖', '👨‍💻', '👩‍💻', '🦊', '🐺', '🐱', 
                      '🦁', '🐼', '🐨', '🦄', '🐉', '🌟', '⚡', '🔥'
                    ].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => setSelectedAvatar(emoji)}
                        className={`aspect-square rounded-xl border-2 text-2xl flex items-center justify-center transition-all ${
                          selectedAvatar === emoji 
                            ? 'border-blue-500 bg-blue-500/20' 
                            : 'border-zinc-700 hover:border-zinc-500'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-500 mt-2">Selected: {selectedAvatar || 'None'}</p>
                </div>

                {/* Preview */}
                <div className="border-t border-zinc-800 pt-4">
                  <p className="text-sm font-medium text-zinc-400 mb-3">Preview</p>
                  <div className="flex items-center gap-3 p-3 bg-zinc-900/30 rounded-xl">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-lg">
                      {selectedAvatar || '👤'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{tempDisplayName || 'Anonymous'}</p>
                      <p className="text-xs text-zinc-500">Your new profile</p>
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
        </>
    );
}