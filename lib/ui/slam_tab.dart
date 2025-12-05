import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';
import 'widgets/camera_overlay.dart';
import 'widgets/trajectory_plot.dart';

class SlamTab extends ConsumerStatefulWidget {
  const SlamTab({super.key});

  @override
  ConsumerState<SlamTab> createState() => _SlamTabState();
}

class _SlamTabState extends ConsumerState<SlamTab> {
  bool showFeatures = true;
  List<Offset> features = const [];

  @override
  Widget build(BuildContext context) {
    final controller = ref.watch(slamControllerProvider);
    final poses = ref.watch(slamHistoryProvider);
    final cam = ref.watch(cameraServiceProvider).controller;

    return SafeArea(
      child: Column(
        children: [
          Expanded(
            child: cam == null
                ? const Center(child: Text('Camera not started'))
                : Stack(
                    children: [
                      CameraPreview(cam),
                      CameraOverlay(showFeatures: showFeatures, features: features),
                    ],
                  ),
          ),
          TrajectoryPlot(poses: poses),
          Wrap(
            spacing: 12,
            children: [
              ElevatedButton.icon(
                onPressed: () async {
                  await controller.start(intrinsics: const [800, 800, 320, 240]);
                  setState(() {});
                },
                icon: const Icon(Icons.play_arrow),
                label: const Text('Start'),
              ),
              ElevatedButton.icon(
                onPressed: controller.stop,
                icon: const Icon(Icons.stop),
                label: const Text('Stop'),
              ),
              ElevatedButton.icon(
                onPressed: controller.reset,
                icon: const Icon(Icons.refresh),
                label: const Text('Reset'),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Features'),
                  Switch(
                    value: showFeatures,
                    onChanged: (v) => setState(() => showFeatures = v),
                  ),
                ],
              ),
            ],
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Text('Monocular SLAM placeholder using native OpenCV plugin for features + PnP.'),
          ),
        ],
      ),
    );
  }
}

