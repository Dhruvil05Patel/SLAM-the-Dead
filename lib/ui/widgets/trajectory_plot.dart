import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:vector_math/vector_math_64.dart';

import '../../core/pose_types.dart';

class TrajectoryPlot extends StatelessWidget {
  const TrajectoryPlot({
    super.key,
    required this.poses,
    this.color = Colors.cyan,
    this.secondary,
    this.secondaryColor = Colors.orange,
  });

  final List<Pose> poses;
  final List<Pose>? secondary;
  final Color color;
  final Color secondaryColor;

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 1,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: LineChart(
          LineChartData(
            gridData: const FlGridData(show: true),
            titlesData: const FlTitlesData(show: true),
            lineBarsData: [
              _line(poses, color),
              if (secondary != null) _line(secondary!, secondaryColor),
            ],
          ),
          duration: const Duration(milliseconds: 150),
        ),
      ),
    );
  }

  LineChartBarData _line(List<Pose> data, Color c) {
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

