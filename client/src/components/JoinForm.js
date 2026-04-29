"use client";
import { useState } from "react";

export default function JoinForm({ onJoin, onCancel }) {
    const [code, setCode] = useState("");

    const handleSubmit = (e) => {
        e.preventDefault();
        if (code.length === 4) onJoin(code.toUpperCase());
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-8 w-full">
            <input 
                type="text" 
                placeholder="Enter 4-Digit Code" 
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="text-center text-3xl tracking-widest p-4 border-2 border-blue-100 rounded-xl focus:outline-none focus:border-blue-400 uppercase text-slate-700"
                maxLength={4}
                required
            />
            <button 
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-sm"
            >
                Connect
            </button>
            <button 
                type="button"
                onClick={onCancel}
                className="text-slate-400 hover:text-slate-600 text-sm mt-2"
            >
                Cancel
            </button>
        </form>
    );
}