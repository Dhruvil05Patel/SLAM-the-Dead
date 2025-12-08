import React, { useMemo } from "react";

/**
 * TrajectoryComparison - Side-by-side SVG visualization of DR vs SLAM trajectories
 */
export default function TrajectoryComparison({ drPath = [], slamTrajectory = [] }) {
  const viewBoxSize = 500;

  // Normalize paths for visualization
  const { drNormalized, slamNormalized } = useMemo(() => {
    // Combine both paths to get unified scaling
    const allPoints = [...(drPath || []), ...(slamTrajectory || [])];
    
    if (allPoints.length === 0) {
      return { drNormalized: [], slamNormalized: [] };
    }

    const xs = allPoints.map((p) => p.x || 0);
    const ys = allPoints.map((p) => p.y || 0);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    const padding = 40;

    // Normalize DR path
    const drNormalized = (drPath || []).map((p) => {
      const nx = ((p.x - minX) / spanX) * (viewBoxSize - padding * 2) + padding;
      const ny = ((p.y - minY) / spanY) * (viewBoxSize - padding * 2) + padding;
      return { x: nx, y: viewBoxSize - ny };
    });

    // Normalize SLAM trajectory
    const slamNormalized = (slamTrajectory || []).map((p) => {
      const nx = ((p.x - minX) / spanX) * (viewBoxSize - padding * 2) + padding;
      const ny = ((p.y - minY) / spanY) * (viewBoxSize - padding * 2) + padding;
      return { x: nx, y: viewBoxSize - ny };
    });

    return { drNormalized, slamNormalized };
  }, [drPath, slamTrajectory]);

  // Generate path data strings
  const drPathData = drNormalized
    .map((p, idx) => `${idx === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  const slamPathData = slamNormalized
    .map((p, idx) => `${idx === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        className="w-full h-auto bg-black/20 border border-white/10 rounded-2xl p-4"
        style={{ aspectRatio: "1" }}
      >
        {/* Background grid */}
        <defs>
          <pattern
            id="grid"
            width="50"
            height="50"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 50 0 L 0 0 0 50"
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="0.5"
            />
          </pattern>
          <linearGradient
            id="drGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#5bf870" stopOpacity="1" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient
            id="slamGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#9efcf6" stopOpacity="1" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Grid background */}
        <rect width={viewBoxSize} height={viewBoxSize} fill="url(#grid)" />

        {/* DR Path */}
        {drPathData && (
          <>
            <path
              d={drPathData}
              fill="none"
              stroke="url(#drGradient)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.85"
              filter="drop-shadow(0 0 8px rgba(91, 248, 112, 0.4))"
            />
            {/* DR start point */}
            {drNormalized.length > 0 && (
              <circle
                cx={drNormalized[0].x}
                cy={drNormalized[0].y}
                r="5"
                fill="#22c55e"
                stroke="white"
                strokeWidth="2"
              />
            )}
            {/* DR end point */}
            {drNormalized.length > 0 && (
              <circle
                cx={drNormalized[drNormalized.length - 1].x}
                cy={drNormalized[drNormalized.length - 1].y}
                r="5"
                fill="#16a34a"
                stroke="white"
                strokeWidth="2"
              />
            )}
          </>
        )}

        {/* SLAM Path */}
        {slamPathData && (
          <>
            <path
              d={slamPathData}
              fill="none"
              stroke="url(#slamGradient)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.85"
              filter="drop-shadow(0 0 8px rgba(158, 252, 246, 0.4))"
            />
            {/* SLAM start point */}
            {slamNormalized.length > 0 && (
              <circle
                cx={slamNormalized[0].x}
                cy={slamNormalized[0].y}
                r="5"
                fill="#22c55e"
                stroke="white"
                strokeWidth="2"
              />
            )}
            {/* SLAM end point */}
            {slamNormalized.length > 0 && (
              <circle
                cx={slamNormalized[slamNormalized.length - 1].x}
                cy={slamNormalized[slamNormalized.length - 1].y}
                r="5"
                fill="#16a34a"
                stroke="white"
                strokeWidth="2"
              />
            )}
          </>
        )}

        {/* Axes */}
        <line
          x1="30"
          y1={viewBoxSize - 30}
          x2={viewBoxSize - 10}
          y2={viewBoxSize - 30}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1"
        />
        <line
          x1="30"
          y1="10"
          x2="30"
          y2={viewBoxSize - 30}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1"
        />
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-6 mt-6 text-xs sm:text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full" style={{ background: "url(#drGradient)" }} />
          <span className="text-slate-200">Dead Reckoning (DR)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full" style={{ background: "url(#slamGradient)" }} />
          <span className="text-slate-200">Visual SLAM</span>
        </div>
      </div>
    </div>
  );
}
