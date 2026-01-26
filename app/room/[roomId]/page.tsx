"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { getRoom, getUserData, updateUserDisplayName } from "@/lib/firestore";
import { sendMessageToRoom, listenToRoomMessages } from "@/lib/messages";
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
import { Send, Users, ChevronLeft, ShieldCheck, UserCheck, Clock, Hash, Zap, Radio } from "lucide-react";

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

    const handleSend = async () => {
        if (!user || !input.trim()) return;
        const msgText = input;
        setInput(""); 
        if (currentChat === "group") await sendMessageToRoom(roomId as string, msgText, user.uid);
        else await sendPrivateMessage(currentChat, msgText, user.uid);
    };

    const handleSaveDisplayName = async () => {
        if (!user || !tempDisplayName.trim()) return;
        const success = await updateUserDisplayName(user.uid, tempDisplayName.trim());
        if (success) {
            setUserNames(prev => ({ ...prev, [user.uid]: tempDisplayName.trim() }));
            setIsEditingName(false);
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
        <div className="flex h-screen bg-[#050505] text-zinc-300 font-sans overflow-hidden">
            {/* SIDEBAR - Ultra Modern Glassmorphism */}
            <aside className="w-80 bg-black/40 border-r border-zinc-800/50 flex flex-col z-30 backdrop-blur-2xl">
                <div className="p-8 border-b border-zinc-800/50 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-600 to-transparent opacity-50" />
                    <button onClick={() => router.push("/")} className="flex items-center text-[9px] text-zinc-600 hover:text-white transition-all mb-6 uppercase font-black tracking-[0.2em]">
                        <ChevronLeft size={14} className="mr-1" /> Exit Protocol
                    </button>
                    <h1 className="text-2xl font-black text-white truncate tracking-tighter flex items-center gap-2">
                        <Hash className="text-blue-600" size={20} />
                        {decodedTopic.toUpperCase()}
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
                            const isPending = sentRequests.includes(u.userId);

                            return (
                                <div key={u.id} className="flex justify-between items-center p-4 group hover:bg-zinc-900/30 rounded-2xl transition-all border border-transparent hover:border-zinc-800/50 mb-1">
                                    <div className="flex flex-col">
                                        <span className={`text-xs font-black tracking-tight ${u.userId === user.uid ? 'text-blue-500' : 'text-zinc-400'}`}>
                                            {u.userId === user.uid ? "YOU (HOST)" : `USER_${u.userId.slice(0,4)}`}
                                        </span>
                                        <span className="text-[8px] text-zinc-600 font-bold uppercase">Active Now</span>
                                    </div>
                                    {u.userId !== user.uid && (
                                        alreadyConnected ? (
                                            <div className="bg-blue-600/10 p-2 rounded-lg text-blue-500">
                                                <UserCheck size={14} />
                                            </div>
                                        ) : isPending ? (
                                            <span className="text-[9px] text-zinc-600 border border-zinc-800 px-3 py-1 rounded-full uppercase font-black">Waiting</span>
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
            <main className="flex-1 flex flex-col relative bg-[#050505]">
                <header className="h-20 border-b border-zinc-900 flex items-center px-10 justify-between bg-black/20 backdrop-blur-md z-20">
                    <div className="flex flex-col">
                        <h2 className="text-[11px] font-black tracking-[0.4em] uppercase text-zinc-500">
                            {currentChat === "group" ? "Signal: Global_Broadcast" : "Signal: Peer_To_Peer_Encrypted"}
                        </h2>
                        <p className="text-[9px] text-blue-600 font-bold uppercase tracking-widest mt-0.5">Latency: 2ms • Security: High</p>
                    </div>
                    <div className="flex -space-x-2">
                        {[1,2,3].map(i => (
                            <div key={i} className="w-8 h-8 rounded-full border-2 border-[#050505] bg-zinc-800" />
                        ))}
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

                {/* Messages Stream - Smooth & Spaced */}
                <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                    {(currentChat === "group" ? messages : (privateMessages[currentChat] || [])).map((msg, i) => {
                        const isMe = msg.userId === user.uid;
                        const senderName = userNames[msg.userId] || `Anon_${msg.userId?.slice(0,4)}`;
                        return (
                            <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`group relative max-w-[60%] transition-all`}>
                                    {!isMe && (
                                        <div className="flex items-center gap-2 mb-2 ml-1">
                                            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-tighter">
                                                {senderName}
                                            </span>
                                            <button
                                                onClick={() => sendConnectRequest(user.uid, msg.userId, decodedTopic)}
                                                disabled={sentRequests.includes(msg.userId)}
                                                className="opacity-0 group-hover:opacity-100 px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 rounded text-[8px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {sentRequests.includes(msg.userId) ? 'Pending' : 'Connect'}
                                            </button>
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
                        <div className="absolute -top-10 left-0 text-[9px] font-black text-zinc-700 uppercase tracking-[0.4em]">Secure Channel Active // Type Message</div>
                        <div className="flex items-center gap-4 bg-zinc-900/40 border border-zinc-800/80 p-3 rounded-[2rem] focus-within:border-blue-600/50 transition-all backdrop-blur-xl focus-within:shadow-[0_0_50px_rgba(59,130,246,0.05)]">
                            <input 
                                className="flex-1 bg-transparent px-6 py-3 outline-none text-sm placeholder:text-zinc-700 placeholder:uppercase placeholder:text-[10px] placeholder:tracking-[0.3em] font-bold text-white" 
                                value={input} 
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                placeholder="Transmit data..."
                            />
                            <button 
                                onClick={handleSend}
                                disabled={!input.trim()}
                                className="bg-white text-black h-12 w-12 flex items-center justify-center rounded-full hover:bg-blue-600 hover:text-white disabled:opacity-5 transition-all group active:scale-90 shadow-2xl"
                            >
                                <Send size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
}