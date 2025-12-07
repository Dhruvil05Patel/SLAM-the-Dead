import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart' as mat;
import 'package:vector_math/vector_math_64.dart';

import '../../core/pose_types.dart';

class TrajectoryPlot extends mat.StatelessWidget {
  const TrajectoryPlot({
    super.key,
    required this.poses,
    this.color = mat.Colors.cyan,
    this.secondary,
    this.secondaryColor = mat.Colors.orange,
  });

  final List<Pose> poses;
  final List<Pose>? secondary;
  final mat.Color color;
  final mat.Color secondaryColor;

  @override
  mat.Widget build(mat.BuildContext context) {
    return mat.Container(
      height: 200, // Fixed height instead of aspect ratio
      padding: const mat.EdgeInsets.all(8),
      child: LineChart(
        LineChartData(
          gridData: const FlGridData(
            show: true,
            drawVerticalLine: false,
            horizontalInterval: 1,
          ),
          titlesData: const FlTitlesData(
            show: true,
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(showTitles: true),
            ),
            leftTitles: AxisTitles(
              sideTitles: SideTitles(showTitles: true),
            ),
            rightTitles: AxisTitles(
              sideTitles: SideTitles(showTitles: false),
            ),
            topTitles: AxisTitles(
              sideTitles: SideTitles(showTitles: false),
            ),
          ),
          borderData: FlBorderData(show: true),
          minX: poses.isNotEmpty ? poses.map((p) => p.position.x).reduce((a, b) => a < b ? a : b) - 0.5 : 0,
          maxX: poses.isNotEmpty ? poses.map((p) => p.position.x).reduce((a, b) => a > b ? a : b) + 0.5 : 1,
          minY: poses.isNotEmpty ? poses.map((p) => p.position.y).reduce((a, b) => a < b ? a : b) - 0.5 : 0,
          maxY: poses.isNotEmpty ? poses.map((p) => p.position.y).reduce((a, b) => a > b ? a : b) + 0.5 : 1,
          lineBarsData: [
            _line(poses, color),
            if (secondary != null) _line(secondary!, secondaryColor),
          ],
        ),
        duration: const Duration(milliseconds: 150),
      ),
    );
  }

  LineChartBarData _line(List<Pose> data, mat.Color c) {
    final points = data.map((p) => FlSpot(p.position.x, p.position.y)).toList();
    return LineChartBarData(
      spots: points.isEmpty ? [const FlSpot(0, 0)] : points,
      color: c,
      isCurved: true,
      dotData: const FlDotData(show: false),
      belowBarData: BarAreaData(show: false),
    );
  }
}

