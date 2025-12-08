import React from "react";

/**
 * A reusable card component to display sensor information.
 */
export default function Card({ title, dataString, unit, theme = "dark" }) {
    const isLight = theme === "light";
    return (
        <div className={`border p-4 rounded-xl mb-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)] ${isLight ? "bg-blue-50/60 border-blue-200 text-slate-900" : "bg-black/35 border-white/15 text-white"}`}>
            <h3 className={`text-xs font-semibold uppercase tracking-[0.18em] ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                {title}
            </h3>
            <p className={`text-sm font-mono mt-2 ${isLight ? "text-slate-800" : "text-slate-100"}`}>{dataString}</p>
            {unit && <p className={`text-xs mt-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>{unit}</p>}
        </div>
    );
}
