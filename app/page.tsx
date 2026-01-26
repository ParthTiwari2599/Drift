"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { createOrJoinRoom } from "@/lib/firestore";
import { 
  Wind, 
  HeartCrack, 
  CloudRain, 
  Brain, 
  Zap, 
  Briefcase, 
  Compass,
  LogOut,
  User
} from "lucide-react"; // Install lucide-react if you haven't

export default function Home() {
  const router = useRouter();
  const { user, loading, signInWithGoogle, signOut } = useAuth();

  const topics = [
    { name: "Anxiety", icon: <Wind size={20} />, color: "border-blue-500/30" },
    { name: "Breakup", icon: <HeartCrack size={20} />, color: "border-red-500/30" },
    { name: "Loneliness", icon: <CloudRain size={20} />, color: "border-purple-500/30" },
    { name: "Overthinking", icon: <Brain size={20} />, color: "border-emerald-500/30" },
    { name: "Stress", icon: <Zap size={20} />, color: "border-yellow-500/30" },
    { name: "Career Pressure", icon: <Briefcase size={20} />, color: "border-orange-500/30" },
    { name: "Feeling Lost", icon: <Compass size={20} />, color: "border-cyan-500/30" },
  ];

  const goToRoom = async (topic: string) => {
    if (!user) return;
    const room = await createOrJoinRoom(topic);
    router.push(`/room/${room.id}`);
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
      
      {/* 1. TEXTURE & BACKGROUND EFFECTS */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Grainy Texture Overaly */}
        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
        
        {/* Animated Glows */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse transition-all duration-1000"></div>
      </div>

      {/* 2. NAVIGATION / AUTH SECTION */}
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
              Sign In
            </button>
          )}
        </div>
      </nav>

      {/* 3. HERO SECTION */}
      <section className="relative z-10 flex flex-col items-center justify-center pt-12 pb-8 px-4 text-center">
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-4 bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">
          What's on your mind?
        </h1>
        <p className="text-zinc-500 text-sm md:text-base max-w-lg leading-relaxed">
          Select a sanctuary. Your words will flow, and like a drift, they will eventually fade into the void. 
          <span className="block mt-1 italic opacity-80 font-serif">No logs. No judgment. Just you and the moment.</span>
        </p>
      </section>

      {/* 4. TOPICS GRID (THE TABS) */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {topics.map((topic, index) => (
            <button
              key={index}
              onClick={() => goToRoom(topic.name)}
              disabled={!user}
              className={`group relative flex flex-col items-start p-6 rounded-2xl border transition-all duration-500 overflow-hidden
                ${user 
                  ? `bg-zinc-900/40 border-white/5 hover:border-white/20 hover:bg-zinc-800/60` 
                  : "bg-zinc-950/20 border-white/5 opacity-40 cursor-not-allowed"
                }`}
            >
              {/* Icon & Label */}
              <div className={`mb-4 p-3 rounded-xl bg-zinc-800/50 group-hover:scale-110 transition-transform duration-500 ${topic.color} border`}>
                {topic.icon}
              </div>
              <h3 className="text-lg font-semibold tracking-tight">{topic.name}</h3>
              <p className="text-xs text-zinc-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Enter Room &rarr;</p>
              
              {/* Subtle Card Glow */}
              <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-white/5 blur-3xl rounded-full group-hover:bg-white/10 transition-colors"></div>
            </button>
          ))}
        </div>

        {/* 5. FOOTER INFO */}
        <footer className="mt-16 text-center">
           <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] uppercase tracking-[0.2em] font-bold transition-all
             ${user ? "border-emerald-500/20 text-emerald-500 bg-emerald-500/5" : "border-zinc-800 text-zinc-500 bg-zinc-900/30"}`}>
             {user ? "● System Active: Secure Connection" : "○ System Idle: Sign in to drift"}
           </div>
        </footer>
      </div>
    </main>
  );
}