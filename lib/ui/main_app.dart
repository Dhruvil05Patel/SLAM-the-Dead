import 'package:flutter/material.dart';

import 'dr_tab.dart';
import 'slam_tab.dart';
import 'comparison_tab.dart';

class MainApp extends StatefulWidget {
  const MainApp({super.key});

  @override
  State<MainApp> createState() => _MainAppState();
}

class _MainAppState extends State<MainApp> {
  int _index = 0;

  final _pages = const [
    DrTab(),
    SlamTab(),
    ComparisonTab(),
  ];

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SLAM vs DR',
      theme: ThemeData.dark(),
      home: Scaffold(
        body: _pages[_index],
        bottomNavigationBar: BottomNavigationBar(
          currentIndex: _index,
          onTap: (i) => setState(() => _index = i),
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.sensors), label: 'DR'),
            BottomNavigationBarItem(icon: Icon(Icons.photo_camera), label: 'SLAM'),
            BottomNavigationBarItem(icon: Icon(Icons.analytics), label: 'Compare'),
          ],
        ),
      ),
    );
  }
}

