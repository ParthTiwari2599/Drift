import React, { useState } from "react";
import { Sparkles, X } from "lucide-react";

interface ModalProps {
  open: boolean;
  title?: string;
  message?: string;
  input?: boolean;
  placeholder?: string;
  onClose: () => void;
  onSubmit?: (value?: string) => void;
  submitLabel?: string;
  cancelLabel?: string;
}

export const AppModal: React.FC<ModalProps> = ({
  open,
  title,
  message,
  input = false,
  placeholder = "Enter text...",
  onClose,
  onSubmit,
  submitLabel = "CONFIRM",
  cancelLabel = "CANCEL",
}) => {
  const [value, setValue] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      {/* Backdrop with heavy blur */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" 
        onClick={onClose} 
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-[380px] group animate-in zoom-in-95 duration-200">
        
        {/* Outer Glow/Border Effect */}
        <div className="absolute -inset-[1px] bg-gradient-to-b from-blue-500/50 to-purple-600/50 rounded-[2rem] blur-[2px] opacity-50" />

        <div className="relative bg-[#0D0D0D] border border-white/10 rounded-[2rem] p-6 sm:p-8 shadow-2xl overflow-hidden">
          
          {/* Subtle Background Pattern */}
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Sparkles size={100} />
          </div>

          {/* Header */}
          <div className="relative z-10 space-y-2 mb-6 text-center">
            {title && (
              <h2 className="text-xl font-black italic tracking-tighter text-white uppercase">
                {title}
              </h2>
            )}
            {message && (
              <p className="text-zinc-400 text-sm font-medium leading-relaxed">
                {message}
              </p>
            )}
          </div>

          {/* Input Section */}
          {input && (
            <div className="relative z-10 mb-8">
              <input
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-center"
                placeholder={placeholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        if (onSubmit) onSubmit(value);
                        onClose();
                    }
                }}
              />
            </div>
          )}

          {/* Actions */}
          <div className="relative z-10 flex flex-col gap-3">
            <button
              className="w-full py-4 rounded-xl bg-white text-black font-black text-xs tracking-[0.2em] uppercase hover:bg-blue-500 hover:text-white transition-all active:scale-95 shadow-lg shadow-white/5"
              onClick={() => {
                if (onSubmit) onSubmit(input ? value : undefined);
                onClose();
              }}
            >
              {submitLabel}
            </button>
            
            <button
              className="w-full py-3 rounded-xl bg-transparent text-zinc-500 font-bold text-[10px] tracking-widest uppercase hover:text-white transition-colors"
              onClick={onClose}
            >
              {cancelLabel}
            </button>
          </div>

          {/* Bottom Branding Decor */}
          <div className="mt-6 pt-4 border-t border-white/5 flex justify-center">
             <div className="px-3 py-1 bg-zinc-900/50 rounded-full border border-white/5">
                <span className="text-[8px] font-black text-zinc-600 tracking-[0.3em] uppercase">Drift_Secure_Protocol</span>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};