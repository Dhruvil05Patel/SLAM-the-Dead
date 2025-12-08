import React, { useMemo } from "react";

/**
 * Lightweight SVG path visualizer (no GPS required).
 * @param {object} props
 * @param {{x:number,y:number}[]} props.path
 */
export default function PathVisualizer({ path }) {
  const viewBoxSize = 400;

  const { normalized, bbox } = useMemo(() => {
    if (!path || path.length === 0) {
      return { normalized: [], bbox: { minX: 0, maxX: 0, minY: 0, maxY: 0 } };
    }

    const xs = path.map((p) => p.x);
    const ys = path.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    const padding = 20;

    const normalized = path.map((p) => {
      const nx = ((p.x - minX) / spanX) * (viewBoxSize - padding * 2) + padding;
      const ny = ((p.y - minY) / spanY) * (viewBoxSize - padding * 2) + padding;
      return { x: nx, y: viewBoxSize - ny }; // invert Y for readability
    });

    return {
      normalized,
      bbox: { minX, maxX, minY, maxY },
    };
  }, [path]);

  const pathData = normalized
    .map((p, idx) => `${idx === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");

  return (
    <div className="bg-black/35 border border-white/15 p-4 rounded-2xl mb-4 text-white shadow-[0_15px_45px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em]">Path Overlay</h3>
        <span className="px-3 py-1 rounded-full text-[11px] border border-white/25 bg-white/10 text-slate-200">
          DR Track
        </span>
      </div>

      <div className="w-full bg-[#0a0f1a] rounded-xl mt-2 overflow-hidden relative border border-white/10" style={{ height: "320px" }}>
        {normalized.length > 1 ? (
          <svg viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} className="w-full h-full">
            <defs>
              <linearGradient id="pathGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#5bf870" />
                <stop offset="50%" stopColor="#9efcf6" />
                <stop offset="100%" stopColor="#ff7ac3" />
              </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="#060910" />
            <g stroke="rgba(255,255,255,0.06)" strokeWidth="1">
              {Array.from({ length: 10 }).map((_, i) => (
                <line key={`v-${i}`} x1={(i + 1) * 36} y1="0" x2={(i + 1) * 36} y2="400" />
              ))}
              {Array.from({ length: 10 }).map((_, i) => (
                <line key={`h-${i}`} x1="0" y1={(i + 1) * 36} x2="400" y2={(i + 1) * 36} />
              ))}
            </g>
            <path d={pathData} fill="none" stroke="url(#pathGrad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <circle r="5" cx={normalized[0].x} cy={normalized[0].y} fill="#22c55e" />
            <circle r="6" cx={normalized[normalized.length - 1].x} cy={normalized[normalized.length - 1].y} fill="#16a34a" />
          </svg>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300 text-sm">
            Awaiting movement data...
          </div>
        )}
      </div>

      <div className="flex justify-between items-center text-xs text-slate-300 mt-2">
        <span>Dead reckoning trail (local frame)</span>
        <div className="text-slate-500">Drag / scroll inside panel to zoom browser</div>
      </div>
    </div>
  );
}
