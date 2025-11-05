import React, { useMemo } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Polyline, Line, Circle, Rect } from 'react-native-svg';
import type { Position } from '../../utils/constants';

type Props = {
  drPath?: Position[];
  slamPath?: Position[];
  showDR?: boolean;
  showSLAM?: boolean;
  padding?: number;
  backgroundColor?: string;
};

const TrajectoryChart: React.FC<Props> = ({
  drPath = [],
  slamPath = [],
  showDR = true,
  showSLAM = true,
  padding = 16,
  backgroundColor = '#0b0b0b0a',
}) => {
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  const { drPoints, slamPoints, bbox } = useMemo(() => {
    const all = [...drPath, ...slamPath];
    const xs = all.map(p => p.x);
    const ys = all.map(p => p.y);
    const minX = Math.min(0, ...xs);
    const maxX = Math.max(0, ...xs);
    const minY = Math.min(0, ...ys);
    const maxY = Math.max(0, ...ys);
    return {
      bbox: { minX, maxX, minY, maxY },
      drPoints: drPath,
      slamPoints: slamPath,
    };
  }, [drPath, slamPath]);

  const toScreen = (p: Position): { x: number; y: number } => {
    const { width, height } = size;
    const innerW = Math.max(1, width - padding * 2);
    const innerH = Math.max(1, height - padding * 2);

    // Expand bbox slightly to avoid clipping
    const dx = bbox.maxX - bbox.minX || 1;
    const dy = bbox.maxY - bbox.minY || 1;
    const scale = Math.min(innerW / dx, innerH / dy);

    const cx = (bbox.maxX + bbox.minX) / 2;
    const cy = (bbox.maxY + bbox.minY) / 2;

    // Centered coordinates
    const sx = (p.x - cx) * scale + width / 2;
    // SVG y increases downward; flip Y to keep up positive
    const sy = height / 2 - (p.y - cy) * scale;
    return { x: sx, y: sy };
  };

  const makePointsAttr = (pts: Position[]) => pts.map(p => {
    const s = toScreen(p);
    return `${s.x},${s.y}`;
  }).join(' ');

  const drPolyline = makePointsAttr(drPoints);
  const slamPolyline = makePointsAttr(slamPoints);
  const drLast = drPoints[drPoints.length - 1];
  const slamLast = slamPoints[slamPoints.length - 1];
  const drLastScreen = drLast ? toScreen(drLast) : undefined;
  const slamLastScreen = slamLast ? toScreen(slamLast) : undefined;

  return (
    <View style={styles.container} onLayout={onLayout}>
      {size.width > 0 && size.height > 0 && (
        <Svg width={size.width} height={size.height}>
          {/* background */}
          <Rect x={0} y={0} width={size.width} height={size.height} fill={backgroundColor} />

          {/* axes grid */}
          <Line x1={padding} y1={size.height/2} x2={size.width - padding} y2={size.height/2} stroke="#ddd" strokeWidth={1} />
          <Line x1={size.width/2} y1={padding} x2={size.width/2} y2={size.height - padding} stroke="#ddd" strokeWidth={1} />

          {/* paths */}
          {showSLAM && slamPoints.length > 1 && (
            <Polyline points={slamPolyline} fill="none" stroke="#4ECDC4" strokeWidth={2} />
          )}
          {showDR && drPoints.length > 1 && (
            <Polyline points={drPolyline} fill="none" stroke="#FF6B6B" strokeWidth={2} />
          )}

          {/* current markers */}
          {showSLAM && slamLastScreen && (
            <Circle cx={slamLastScreen.x} cy={slamLastScreen.y} r={4} fill="#4ECDC4" />
          )}
          {showDR && drLastScreen && (
            <Circle cx={drLastScreen.x} cy={drLastScreen.y} r={4} fill="#FF6B6B" />
          )}
        </Svg>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 300,
    backgroundColor: 'transparent',
  },
});

export default TrajectoryChart;
