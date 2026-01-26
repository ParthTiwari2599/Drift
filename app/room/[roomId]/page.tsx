"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { getRoom, getUserData } from "@/lib/firestore";
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
import { Send, Users, ChevronLeft, ShieldCheck, UserCheck, Hash, Zap, Radio } from "lucide-react";

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

    const bottomRef = useRef<HTMLDivElement | null>(null);
    const QUICK_EMOJIS = ["🔥", "⚡", "💀", "👑", "🚀", "💎", "👾", "✨"];

    /* ------------------- Name Cache (FIXED LOOP) ------------------- */
    useEffect(() => {
        const fetchNames = async () => {
            const uniqueUids = Array.from(new Set([
                ...messages.map(m => m.userId),
                ...activeUsers.map(u => u.userId)
            ])).filter(uid => uid && !userNames[uid]);

            if (uniqueUids.length === 0) return;

            const newFetchedNames: any = {};
            for (const uid of uniqueUids) {
                try {
                    const data = await getUserData(uid);
                    newFetchedNames[uid] = data?.customDisplayName || data?.displayName || `Node_${uid.slice(0, 4)}`;
                } catch (e) {
                    newFetchedNames[uid] = `Node_${uid.slice(0, 4)}`;
                }
            }
            setUserNames(prev => ({ ...prev, ...newFetchedNames }));
        };

        if (messages.length > 0 || activeUsers.length > 0) {
            fetchNames();
        }
        // userNames dependency se hataya gaya hai loop break karne ke liye
    }, [messages, activeUsers]);

    /* ------------------- Room Fetch ------------------- */
    useEffect(() => {
        if (!roomId) return;
        getRoom(roomId as string).then((room) => {
            setRoomData(room);
            setRoomLoading(false);
        }).catch(() => setRoomLoading(false));
    }, [roomId]);

    /* ------------------- Listeners ------------------- */
    useEffect(() => {
        if (!roomId || !user) return;

        joinRoomPresence(roomId as string, user.uid);
        
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
                }
            })
        ];

        const hb = setInterval(() => heartbeatPresence(roomId as string, user.uid), 5000);

        return () => {
            unsubs.forEach(unsub => unsub && unsub());
            leaveRoomPresence(roomId as string, user.uid);
            clearInterval(hb);
        };
    }, [roomId, user]);

    /* ------------------- Private Messages Listeners ------------------- */
    useEffect(() => {
        const unsubs = privateRooms.map(room => 
            listenPrivateMessages(room.id, (msgs) => {
                setPrivateMessages(prev => ({ ...prev, [room.id]: msgs }));
            })
        );
        return () => unsubs.forEach(unsub => unsub && unsub());
    }, [privateRooms]);

    /* ------------------- Auto-scroll ------------------- */
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, privateMessages, currentChat]);

    const handleSend = async () => {
        if (!user || !input.trim()) return;
        const msgText = input.trim();
        setInput(""); 
        try {
            if (currentChat === "group") {
                await sendMessageToRoom(roomId as string, msgText, user.uid);
            } else {
                await sendPrivateMessage(currentChat, msgText, user.uid);
            }
        } catch (error) {
            console.error("Send message error:", error);
        }
    };

    const addEmoji = (emoji: string) => {
        setInput(prev => prev + emoji);
    };

    if (roomLoading) return (
        <div className="h-screen bg-[#050505] flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <div className="text-blue-500 font-mono text-[10px] uppercase tracking-[0.5em] animate-pulse">
                Establishing Secure Uplink...
            </div>
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

            {/* 🔔 RIGHT SIDE TOASTS */}
            <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 w-80">
                {incomingRequests.map((req) => (
                    <div 
                        key={req.id} 
                        className="bg-[#0a0a0a] border border-blue-500/30 p-4 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-xl animate-in slide-in-from-right duration-500 border-l-4 border-l-blue-600"
                    >
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-blue-600/10 rounded-lg">
                                <Zap size={18} className="text-blue-500 animate-pulse" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black uppercase text-blue-500 tracking-tighter">Connection Request</p>
                                <p className="text-xs text-zinc-300 font-bold mt-1 truncate">
                                    {userNames[req.fromUser] || "A New Node"} wants to bridge.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => acceptRequest(req.id)} className="flex-1 bg-blue-600 text-white text-[9px] py-2 rounded-lg font-black uppercase hover:bg-blue-500 transition-all">Accept</button>
                            <button onClick={() => rejectRequest(req.id)} className="flex-1 bg-zinc-900 text-zinc-500 text-[9px] py-2 rounded-lg font-black uppercase hover:bg-zinc-800 transition-all">Decline</button>
                        </div>
                    </div>
                ))}
            </div>

            {/* SIDEBAR */}
            <aside className="w-80 bg-black/40 border-r border-zinc-800/50 flex flex-col z-30 backdrop-blur-2xl">
                <div className="p-8 border-b border-zinc-800/50">
                    <button onClick={() => router.push("/")} className="flex items-center text-[9px] text-zinc-600 hover:text-white transition-all mb-6 uppercase font-black tracking-[0.2em]">
                        <ChevronLeft size={14} className="mr-1" /> Exit Protocol
                    </button>
                    <h1 className="text-2xl font-black text-white truncate tracking-tighter flex items-center gap-2">
                        <Hash className="text-blue-600" size={20} />
                        {decodedTopic.toUpperCase()}
                    </h1>
                    <div className="flex items-center gap-2 mt-3 bg-blue-600/5 w-fit px-3 py-1 rounded-full border border-blue-500/10">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_#3b82f6]" />
                        <p className="text-[10px] text-blue-400 uppercase tracking-widest font-black">
                            {activeCount} Nodes Online
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8 custom-scrollbar">
                    <section>
                        <h3 className="text-[10px] text-zinc-700 font-black uppercase tracking-[0.3em] mb-5 px-4 flex items-center gap-2">
                            <ShieldCheck size={14} className="text-zinc-500" /> Secure Sessions
                        </h3>

                        <div 
                            onClick={() => setCurrentChat("group")}
                            className={`group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all mb-2 border ${
                                currentChat === "group" 
                                    ? 'bg-white text-black border-white' 
                                    : 'hover:bg-zinc-900/50 border-transparent text-zinc-500 hover:text-zinc-200'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <Radio size={18} />
                                <span className="text-xs font-black uppercase">Public Stream</span>
                            </div>
                        </div>

                        {privateRooms.map(room => {
                            const otherUserId = room.userA === user.uid ? room.userB : room.userA;
                            const otherUserName = userNames[otherUserId] || `Node_${otherUserId.slice(0,4)}`;
                            return (
                                <div 
                                    key={room.id} 
                                    onClick={() => setCurrentChat(room.id)}
                                    className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all mb-2 border ${
                                        currentChat === room.id 
                                            ? 'bg-blue-600 border-blue-500 text-white' 
                                            : 'hover:bg-zinc-900/50 border-transparent text-zinc-500 hover:text-zinc-200'
                                    }`}
                                >
                                    <div className={`w-2 h-2 rounded-full ${currentChat === room.id ? 'bg-white animate-pulse' : 'bg-blue-600/40'}`} />
                                    <span className="text-xs font-black uppercase tracking-tight truncate flex-1">
                                        {otherUserName}
                                    </span>
                                </div>
                            );
                        })}
                    </section>
                </div>
            </aside>

            {/* MAIN CHAT */}
            <main className="flex-1 flex flex-col relative bg-[#050505]">
                <header className="h-20 border-b border-zinc-900 flex items-center px-10 justify-between bg-black/20 backdrop-blur-md z-20">
                    <div className="flex flex-col">
                        <h2 className="text-[11px] font-black tracking-[0.4em] uppercase text-zinc-500">
                            {currentChat === "group" ? "Signal: Global_Broadcast" : "Signal: Peer_To_Peer_Encrypted"}
                        </h2>
                        <p className="text-[9px] text-blue-600 font-bold uppercase tracking-widest mt-0.5">Latency: 2ms • Security: High</p>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                    {(currentChat === "group" ? messages : (privateMessages[currentChat] || [])).map((msg, i) => {
                        const isMe = msg.userId === user.uid;
                        const senderName = userNames[msg.userId] || `Anon_${msg.userId?.slice(0,4)}`;
                        return (
                            <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`group relative max-w-[60%] transition-all`}>
                                    {!isMe && (
                                        <span className="text-[9px] font-black text-zinc-600 uppercase mb-2 block ml-1 tracking-tighter">
                                            {senderName}
                                        </span>
                                    )}
                                    <div className={`px-6 py-4 rounded-3xl text-[14px] font-medium leading-relaxed transition-all ${
                                        isMe 
                                            ? 'bg-blue-600 text-white rounded-tr-none' 
                                            : 'bg-zinc-900/50 text-zinc-200 rounded-tl-none border border-zinc-800/50'
                                    }`}>
                                        {msg.text}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={bottomRef} />
                </div>

                <footer className="p-10 pt-0">
                    <div className="max-w-4xl mx-auto relative">
                        <div className="flex gap-2 mb-4">
                            {QUICK_EMOJIS.map(emoji => (
                                <button key={emoji} onClick={() => addEmoji(emoji)} className="w-10 h-10 flex items-center justify-center bg-zinc-900/50 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-all text-lg hover:scale-105">
                                    {emoji}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-4 bg-zinc-900/40 border border-zinc-800/80 p-3 rounded-[2rem]">
                            <input 
                                className="flex-1 bg-transparent px-6 py-3 outline-none text-sm font-bold text-white placeholder:text-zinc-700" 
                                value={input} 
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                                placeholder="TYPE MESSAGE..."
                            />
                            <button 
                                onClick={handleSend}
                                disabled={!input.trim()}
                                className="bg-white text-black h-12 w-12 flex items-center justify-center rounded-full hover:bg-blue-600 hover:text-white disabled:opacity-5 disabled:cursor-not-allowed transition-all active:scale-90 shadow-lg"
                            >
                                <Send size={20} />
                            </button>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
}