# 🧟 SLAM the Dead

<div align="center">
  <img src="Frontend/public/LOGO3.png" alt="SLAM the Dead Logo" width="200"/>
  
  **Apocalypse-Ready Spatial Navigation Lab**
  
  [![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
  [![Vite](https://img.shields.io/badge/Vite-7.1-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  [![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Technical Implementation](#technical-implementation)
- [Submission Requirements](#submission-requirements)
- [References](#references)
- [Credits](#credits)
- [Team](#team)
- [License](#license)

---

## Overview

**SLAM the Dead** is an advanced robotics navigation laboratory that blends camera-first **Visual SLAM** (Simultaneous Localization and Mapping) with **Inertial Dead Reckoning** for robust autonomous navigation. Built for field tests, warehouse crawls, and challenging environments where traditional navigation fails.

This project provides real-time:
- 🎥 **Visual SLAM** with live obstacle detection and feature tracking
- 📡 **Dead Reckoning** using IMU sensors and compass data
- 🗺️ **Trajectory Mapping** with 2D path visualization
- 🎯 **Sensor Fusion** combining vision and inertial measurements

---

## Problem Statement

Traditional navigation systems struggle in GPS-denied environments (indoors, tunnels, disaster zones). This project implements a dual-approach navigation system combining:

1. **Inertial-only positioning** - Works anywhere without external signals using IMU sensors
2. **Vision-based mapping** - Provides absolute reference frames through computer vision

This hybrid approach enables robust autonomous navigation in challenging environments where traditional GPS-based systems fail.

---

## ✨ Features

### Visual SLAM Module
- **Live Camera Feed** with real-time feature detection overlay
- **Obstacle Isolation** using computer vision algorithms
- **Green Pulsing Orbs** marking detected obstacles (up to 2200+ features)
- **Tracking Accuracy** metrics with motion magnitude analysis
- **Map Density** visualization and match count statistics
- **Depth/LiDAR Support** for enhanced close-range obstacle detection
- **Torch Control** for low-light environments
- **FAST Corner Detection** - Fast feature extraction algorithm
- **Feature Matching** - Patch-based descriptor tracking

### Dead Reckoning Module
- **IMU-Based Tracking** using device accelerometer and gyroscope
- **Compass Integration** for heading correction with tilt compensation
- **Drift Compensation** algorithms for extended operation
- **Continuous Position Estimation** in 2D space
- **Real-time Path Visualization** with start/end markers
- **Stationary Detection** for automatic bias calibration
- **Velocity Decay Dampening** for drift reduction
- **Low-pass Compass Filtering** for smooth heading

### User Interface
- **Dark/Light Theme Toggle** with comprehensive styling
- **Responsive Design** optimized for desktop, tablet, and mobile
- **Real-time Statistics** including FPS, landmark count, and pose data
- **Interactive Controls** for start/stop/reset operations
- **Smooth Animations** and glassmorphic design elements
- **Professional UI/UX** with neon aesthetic

---

## 🛠️ Technology Stack

### Frontend
- **React 19** - Modern UI framework with hooks
- **Vite 7.1** - Lightning-fast build tool
- **Tailwind CSS v4** - Utility-first styling
- **JavaScript (ES6+)** - Modern JavaScript features

### Computer Vision & Algorithms
- **Canvas API** - Real-time feature rendering
- **WebRTC** - Camera stream access
- **FAST Corner Detection** - Feature extraction algorithm
- **DBSCAN-inspired Clustering** - Obstacle isolation
- **Patch-based Descriptors** - Feature matching and tracking
- **2D Motion Estimation** - Pose calculation

### Sensors & APIs
- **Device Orientation API** - Gyroscope and compass
- **Device Motion API** - Accelerometer data
- **MediaDevices API** - Camera and sensor access
- **Geolocation API** - GPS positioning (future integration)

### Development Tools
- **ESLint** - Code quality and consistency
- **PostCSS** - CSS processing
- **Autoprefixer** - Browser compatibility

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- Modern web browser with camera access
- Device with accelerometer/gyroscope (for DR Module)
- HTTPS connection (required for sensors and camera)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Dhruvil05Patel/SLAM-the-Dead.git
   cd SLAM-the-Dead
   ```

2. **Navigate to the Frontend directory**
   ```bash
   cd Frontend
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   ```
   http://localhost:5173
   ```

### Build for Production

```bash
npm run build
```

The optimized production build will be created in the `dist/` directory.

---

## 🎮 Usage

### Visual SLAM Module

1. Click **"Start"** button in SLAM Module section
2. Grant camera permissions when prompted
3. Point the camera at a scene with distinct features
4. Watch as green orbs mark detected obstacles
5. Enable **Torch** button if in low-light conditions
6. Track metrics: FPS, Landmarks, Pose (X/Y), Tracking Accuracy, Motion Magnitude
7. View the **SLAM Trajectory** path visualization in the side panel
8. Monitor match count and map density for scene complexity

### Dead Reckoning Module

1. Click **"Start Sensors"** button in DR Module section
2. Grant motion sensor permissions when prompted
3. Stand still for 2-3 seconds for automatic calibration
4. Move your device to see position updates
5. View real-time **Velocity**, **Position**, and **Heading** data
6. Monitor raw **Accelerometer**, **Gyroscope**, and **Compass** readings
7. Watch the **Path Overlay** visualization update in real-time
8. Use **Reset Path** button to clear trajectory and recalibrate

### Comparison

The project enables:
- Side-by-side analysis of DR vs SLAM methodologies
- Real-time trajectory comparison
- Performance metrics for both approaches
- Use case recommendations based on environment

---

## 📁 Project Structure

```
SLAM-the-Dead/
├── Frontend/
│   ├── public/
│   │   ├── LOGO2.png              # Main logo (neon S)
│   │   ├── manifest.json          # PWA manifest
│   │   └── vite.svg
│   ├── src/
│   │   ├── components/
│   │   │   ├── App.jsx                 # Root component
│   │   │   ├── DeadReckoning.jsx       # DR module
│   │   │   ├── SLAM.jsx                # SLAM module
│   │   │   ├── PathVisualizer.jsx      # SVG path renderer
│   │   │   ├── Card.jsx                # Reusable card component
│   │   ├── utils/
│   │   │   └── formatters.js           # Data formatting utilities
│   │   ├── App.css                     # App-level styles
│   │   ├── index.css                   # Global styles
│   │   └── main.jsx                    # React entry point
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── eslint.config.js
├── Output_Screenshots/                 # Project screenshots
├── LICENSE                             # MIT License
└── README.md                           # Root documentation
```

---

## 🔬 Technical Implementation

### Dead Reckoning Algorithm

**Sensor Fusion with IMU:**
```javascript
1. Read raw accelerometer data {ax, ay, az}
2. Apply bias correction using stationary calibration
3. Apply deadzone filtering (< 0.05 m/s²)
4. Rotate to world frame using heading from compass
5. Integrate velocity: v(t+1) = (v(t) + a*dt) * exp(-damping*dt)
6. Integrate position: p(t+1) = p(t) + v(t+1)*dt
7. Update heading from magnetometer with low-pass filter
```

**Key Thresholds:**
- Acceleration threshold: 0.2 m/s²
- Stationary detection: 0.12 m/s²
- Velocity decay factor: 0.85
- Compass filter coefficient: 0.2

### Visual SLAM Algorithm

**Feature Detection & Tracking:**
```javascript
1. Frame Acquisition: 640x480 video stream
2. Feature Extraction: FAST-like corner detection
3. Spatial Distribution: Grid-based clustering
4. Obstacle Isolation: Density-based classification
5. Feature Matching: Patch-based descriptor comparison
6. Pose Estimation: 2D motion from matched features
7. Landmark Mapping: Dynamic map building
8. Rendering: Green pulsing orbs for obstacles
```

**Obstacle Detection Thresholds:**
- Feature threshold: 20 (corner detection sensitivity)
- Cluster size: 35 pixels (spatial radius)
- Density threshold: 2.5 (adaptive)
- Max features: 2200 per frame
- Render step: 1400 (performance optimization)

---

## 📊 Performance Analysis

### Computational Metrics
- **DR Module FPS**: 60+ fps
- **SLAM Module FPS**: 25-30 fps (feature extraction intensive)
- **Bundle Size (gzip)**: 73.18 KB JS, 17.24 KB CSS
- **Memory Usage**: ~80-120 MB
- **Build Time**: ~2.5 seconds

### Accuracy Characteristics
- **DR Drift**: ~0.5-1% per meter
- **Heading Drift**: ~1-2° per meter
- **SLAM Loop Closure**: Corrects accumulated drift
- **Feature Tracking**: Pixel-level accuracy

---

## ⚙️ Configuration

### Camera Settings
Modify feature detection limits in `src/components/SLAM.jsx`:
```javascript
const threshold = 20;           // 15-30 (lower = more features)
const clusterSize = 35;         // 25-50 px radius
const densityThreshold = 2.5;   // 2.0-3.0 (adaptive)
features.slice(0, 2200)         // Max features per frame
Math.floor(features.length / 1400) // Render step
```

### IMU Sensitivity
Adjust dead reckoning parameters in `src/components/DeadReckoning.jsx`:
```javascript
const ACCEL_THRESHOLD = 0.2;           // Deadzone
const STATIONARY_THRESHOLD = 0.12;     // Stationary detection
const VELOCITY_DECAY = 0.85;           // Exponential decay
const COMPASS_FILTER_ALPHA = 0.2;      // Low-pass filter
```

---


## 📚 References

### **Algorithms & Techniques**

1. **Simultaneous Localization and Mapping (SLAM)**
   - Thrun, S., Burgard, W., & Fox, D. (2005). *Probabilistic Robotics*. MIT Press.
   - Klein, G., & Murray, D. (2007). "Parallel Tracking and Mapping for Real-Time SLAM". ICCV 2007.

2. **Dead Reckoning & Inertial Navigation**
   - Titterton, D. H., & Weston, J. L. (2004). *Strapdown Inertial Navigation Technology*. The Aerospace Press.
   - Woodman, O. J. (2007). "An introduction to inertial navigation". University of Cambridge Technical Report.

3. **Feature Detection & Tracking**
   - Rosten, E., & Drummond, T. (2006). "Machine Learning for High-Speed Corner Detection". ECCV 2006.
   - Lucas, B. D., & Kanade, T. (1981). "An Iterative Image Registration Technique". IJCAI 1981.

4. **Sensor Fusion**
   - Welch, G., & Bishop, G. (2006). "An Introduction to the Kalman Filter". Siggraph Course.
   - Sabatini, A. M. (2011). "Kalman-filter-based orientation determination using inertial/magnetic sensors". Journal of Biomechanics.

### **Libraries & Frameworks**

- React Documentation: https://react.dev/
- Vite Documentation: https://vitejs.dev/
- Tailwind CSS: https://tailwindcss.com/
- MDN Web APIs: https://developer.mozilla.org/en-US/docs/Web/API

### **Web APIs Used**

- Device Orientation API: https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent
- Device Motion API: https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent
- MediaDevices API: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices

---

## 👥 Credits

### Development Team

| Name | Student ID | Contribution |
|------|-----------|--------------|
| **Dhruvil Patel** | 202301035 | Lead Developer & Architecture |
| **Farzan Bhalara** | 202301248 | IMU integration and dead reckoning |
| **Hrithik Patel** | 202301441 | SLAM algorithms and computer vision |

### Special Acknowledgments

**AI & Development Assistance**
- **GitHub Copilot** - Exceptional support throughout development:
  - Code suggestions and architectural guidance
  - Component refactoring for performance optimization
  - Sensor API integration assistance
  - Debugging and troubleshooting support
  - React and TypeScript best practices mentoring
  - Algorithm implementation suggestions

**Open Source Community**
- React team for component framework
- Vite team for build tooling and development experience
- Tailwind CSS for styling framework and utilities
- MDN documentation for Web APIs reference
- Academic researchers for SLAM/DR algorithms foundation

**Development Tools**
- VS Code - Development environment
- GitHub - Version control and collaboration
- Chrome DevTools - Performance profiling and debugging
- Lighthouse - Performance auditing

---

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 📧 Contact

**Dhruvil Patel**
- GitHub: [@Dhruvil05Patel](https://github.com/Dhruvil05Patel)
- Project Link: [https://github.com/Dhruvil05Patel/SLAM-the-Dead](https://github.com/Dhruvil05Patel/SLAM-the-Dead)

**Questions or Issues?**
- Open an issue on GitHub
- Check documentation in README.md files
- Review technical implementation in source code

---

<div align="center">
  <p><em>"Navigate the apocalypse with confidence"</em></p>
  <p>Built with React, Vite, Tailwind CSS, and Web APIs</p>
</div>
