import React, { useEffect, useState, useRef } from "react";
import "./App.css";
import DeadReckoning from "./components/DeadReckoning";
import SLAM from "./components/SLAM";

const CONTRIBUTORS = [
  { name: "Dhruvil Patel", role: "Lead Developer", icon: "👨‍💻", description: "Architecture and full-stack implementation" },
  { name: "Hrithik Patel", role: "SLAM & Computer Vision", icon: "👁️", description: "Visual SLAM algorithms and feature detection" },
  { name: "Farzan Bhalara", role: "IMU & Dead Reckoning", icon: "📡", description: "Inertial measurement and motion tracking" },
];

export default function App() {
  const [theme, setTheme] = useState("dark");
  const [menuOpen, setMenuOpen] = useState(false);
  const [drTrajectory, setDrTrajectory] = useState([]);
  const [slamTrajectory, setSlamTrajectory] = useState([]);
  const heroRef = useRef(null);
  const drRef = useRef(null);
  const slamRef = useRef(null);
  const comparisonRef = useRef(null);
  const teamRef = useRef(null);
  const footerRef = useRef(null);


  useEffect(() => {
    document.body.classList.toggle("theme-light", theme === "light");
    document.body.classList.toggle("theme-dark", theme === "dark");
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const scrollToSection = (ref) => {
    setMenuOpen(false);
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className={`min-h-screen flex flex-col ${theme === "light" ? "theme-light text-slate-900" : "theme-dark text-white"}`}>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-black/40 border-b border-white/10 backdrop-blur-lg z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img src="/LOGO2.png" alt="SLAM the Dead" className="h-8 sm:h-10 w-auto" />
            <span className="text-sm sm:text-lg font-semibold text-emerald-300 hidden sm:inline">SLAM the Dead</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <button
              onClick={() => scrollToSection(heroRef)}
              className="text-sm text-slate-200 hover:text-emerald-300 transition"
            >
              Home
            </button>
            <button
              onClick={() => scrollToSection(drRef)}
              className="text-sm text-slate-200 hover:text-emerald-300 transition"
            >
              DR Module
            </button>
            <button
              onClick={() => scrollToSection(slamRef)}
              className="text-sm text-slate-200 hover:text-emerald-300 transition"
            >
              SLAM Module
            </button>
            <button
              onClick={() => scrollToSection(comparisonRef)}
              className="text-sm text-slate-200 hover:text-emerald-300 transition"
            >
              Comparison
            </button>
            <button
              onClick={() => scrollToSection(teamRef)}
              className="text-sm text-slate-200 hover:text-emerald-300 transition"
            >
              👥 Team
            </button>
          </nav>

          {/* Right side controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="theme-toggle"
              aria-pressed={theme === "light"}
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>

            {/* Hamburger Menu */}
            <button
              onClick={toggleMenu}
              className="md:hidden px-3 py-2 rounded-xl border border-white/20 bg-white/5 text-sm font-semibold hover:border-white/50 transition cursor-pointer"
              aria-label="Toggle menu"
            >
              ☰
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden bg-black/20 border-t border-white/10 backdrop-blur-sm">
            <nav className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-3">
              <button
                onClick={() => scrollToSection(heroRef)}
                className="text-left px-4 py-2 text-sm text-slate-200 hover:text-emerald-300 hover:bg-white/5 rounded-lg transition"
              >
                Home
              </button>
              <button
                onClick={() => scrollToSection(drRef)}
                className="text-left px-4 py-2 text-sm text-slate-200 hover:text-emerald-300 hover:bg-white/5 rounded-lg transition"
              >
                DR Module
              </button>
              <button
                onClick={() => scrollToSection(slamRef)}
                className="text-left px-4 py-2 text-sm text-slate-200 hover:text-emerald-300 hover:bg-white/5 rounded-lg transition"
              >
                SLAM Module
              </button>
              <button
                onClick={() => scrollToSection(comparisonRef)}
                className="text-left px-4 py-2 text-sm text-slate-200 hover:text-emerald-300 hover:bg-white/5 rounded-lg transition"
              >
                Comparison
              </button>
              <button
                onClick={() => scrollToSection(teamRef)}
                className="text-left px-4 py-2 text-sm text-slate-200 hover:text-emerald-300 hover:bg-white/5 rounded-lg transition"
              >
                👥 Meet the Team
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-20">
        {/* Hero Section */}
        <section
          ref={heroRef}
          className="min-h-screen flex items-center justify-center relative px-4 sm:px-6 md:px-10 py-12"
        >
          <div className="max-w-7xl w-full">
            <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6 sm:gap-10 items-start lg:items-center">
              <div className="grid-frame p-6 sm:p-8 md:p-10 relative overflow-hidden">
                <div className="flex items-center gap-3 mb-4">
                  <span className="divider-dot" />
                  <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-emerald-200/90">
                    SLAM the Dead
                  </p>
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold leading-tight drop-shadow mb-4">
                  Apocalypse-ready spatial navigation lab for robots that never lose the trail.
                </h1>
                <p className="text-xs sm:text-sm md:text-base text-slate-200/90 mt-4 max-w-2xl mb-6">
                  Blend camera-first SLAM and inertial dead reckoning inside a single mission console. Built for field tests,
                  warehouse crawls, and spooky basements alike.
                </p>

                <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3">
                  <button
                    onClick={() => scrollToSection(drRef)}
                    className="cta-button hover-float px-6 py-3 rounded-xl text-xs sm:text-sm font-semibold shadow-lg w-full sm:w-auto"
                  >
                    Explore DR Module
                  </button>
                  <button
                    onClick={() => scrollToSection(slamRef)}
                    className="px-6 py-3 rounded-xl border border-white/20 bg-white/5 text-xs sm:text-sm font-semibold hover:border-white/50 transition hover-float w-full sm:w-auto"
                  >
                    Explore SLAM Module
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mt-8 text-xs text-slate-200/90">
                  {["Obstacle overlays", "IMU + compass", "Depth-ready", "Real-time mapping"].map((label) => (
                    <div
                      key={label}
                      className="tag-chip px-3 py-2 rounded-lg flex items-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                      <span className="hidden sm:inline text-[10px]">{label}</span>
                      <span className="sm:hidden text-[9px]">{label.split(" ")[0]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hero Stats Card */}
              <div className="space-y-4">
                <div className="module-card rounded-3xl p-4 sm:p-6 shadow-xl">
                  <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.22em] text-emerald-200/80 mb-2">
                    Live Console
                  </p>
                  <div className="text-xl sm:text-2xl font-semibold mb-4">Mission Status</div>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                    <div className="bg-black/30 border border-white/10 rounded-2xl p-3">
                      <p className="text-slate-300 text-[10px] sm:text-xs">Frame rate</p>
                      <p className="text-lg sm:text-2xl font-semibold text-emerald-300">60+</p>
                    </div>
                    <div className="bg-black/30 border border-white/10 rounded-2xl p-3">
                      <p className="text-slate-300 text-[10px] sm:text-xs">Sensor link</p>
                      <p className="text-lg sm:text-2xl font-semibold text-cyan-300">Ready</p>
                    </div>
                    <div className="bg-black/30 border border-white/10 rounded-2xl p-3">
                      <p className="text-slate-300 text-[10px] sm:text-xs">Map mode</p>
                      <p className="text-lg sm:text-2xl font-semibold text-pink-300">Hybrid</p>
                    </div>
                    <div className="bg-black/30 border border-white/10 rounded-2xl p-3">
                      <p className="text-slate-300 text-[10px] sm:text-xs">Systems</p>
                      <p className="text-lg sm:text-2xl font-semibold text-amber-200">Active</p>
                    </div>
                  </div>
                </div>

                <div className="module-card rounded-3xl p-4 sm:p-5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] sm:text-xs uppercase tracking-[0.18em] text-slate-300">
                      Build #ST-09
                    </p>
                    <p className="text-base sm:text-lg font-semibold">Zombie-safe navigation</p>
                  </div>
                  <div className="divider-dot" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* DR Module Section */}
        <section
          ref={drRef}
          className="min-h-screen flex items-center justify-center relative px-4 sm:px-6 md:px-10 py-12 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent"
        >
          <div className="max-w-7xl w-full">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="divider-dot" />
                <p className="text-xs sm:text-sm uppercase tracking-[0.2em] text-emerald-200/80">
                  Gravemark IMU Core
                </p>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">Dead Reckoning Module</h2>
              <p className="text-sm sm:text-base text-slate-200/85 max-w-3xl">
                Inertial measurement unit tracking with drift compensation, heading filtering, and continuous position estimation.
              </p>
            </div>
            <div className="module-card rounded-3xl p-6 sm:p-8 md:p-10">
              <DeadReckoning theme={theme} onTrajectoryUpdate={setDrTrajectory} />
            </div>
          </div>
        </section>

        {/* SLAM Module Section */}
        <section
          ref={slamRef}
          className="min-h-screen flex items-center justify-center relative px-4 sm:px-6 md:px-10 py-12 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent"
        >
          <div className="max-w-7xl w-full">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="divider-dot" />
                <p className="text-xs sm:text-sm uppercase tracking-[0.2em] text-cyan-200/80">
                  Specter SLAM
                </p>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">Visual SLAM Module</h2>
              <p className="text-sm sm:text-base text-slate-200/85 max-w-3xl">
                Camera-first visual odometry with real-time feature detection, obstacle isolation, and depth-aware rendering.
              </p>
            </div>
            <div className="module-card rounded-3xl p-6 sm:p-8 md:p-10">
              <SLAM theme={theme} onTrajectoryUpdate={setSlamTrajectory} />
            </div>
          </div>
        </section>

        {/* Comparison Section */}
        <section
          ref={comparisonRef}
          className="min-h-screen flex items-center justify-center relative px-4 sm:px-6 md:px-10 py-12 bg-gradient-to-b from-transparent via-pink-500/5 to-transparent"
        >
          <div className="max-w-7xl w-full">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="divider-dot" />
                <p className="text-xs sm:text-sm uppercase tracking-[0.2em] text-pink-200/80">
                  Analysis
                </p>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">DR vs SLAM Comparison</h2>
              <p className="text-sm sm:text-base text-slate-200/85 max-w-3xl">
                Visual comparison between Dead Reckoning and Visual SLAM methodologies.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
              {/* DR Comparison Card */}
              <div className="module-card rounded-3xl p-6 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl sm:text-2xl font-bold text-emerald-300">Dead Reckoning</h3>
                  <span className="px-3 py-1 rounded-full text-[10px] sm:text-[11px] bg-emerald-500/15 border border-emerald-300/40 text-emerald-100">
                    IMU-Based
                  </span>
                </div>
                <ul className="space-y-3 text-xs sm:text-sm text-slate-200/85">
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 font-bold mt-1">✓</span>
                    <span>Continuous position tracking using accelerometer and compass</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-emerald-400 font-bold mt-1">✓</span>
                    <span>Works in complete darkness and feature-poor environments</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-slate-400 font-bold mt-1">⚠</span>
                    <span>Accumulates drift over time without external correction</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-slate-400 font-bold mt-1">⚠</span>
                    <span>Requires periodic calibration to maintain accuracy</span>
                  </li>
                </ul>
              </div>

              {/* SLAM Comparison Card */}
              <div className="module-card rounded-3xl p-6 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl sm:text-2xl font-bold text-cyan-300">Visual SLAM</h3>
                  <span className="px-3 py-1 rounded-full text-[10px] sm:text-[11px] bg-cyan-500/15 border border-cyan-300/40 text-cyan-100">
                    Vision-Based
                  </span>
                </div>
                <ul className="space-y-3 text-xs sm:text-sm text-slate-200/85">
                  <li className="flex items-start gap-3">
                    <span className="text-cyan-400 font-bold mt-1">✓</span>
                    <span>Absolute reference through visual feature tracking</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-cyan-400 font-bold mt-1">✓</span>
                    <span>No drift accumulation over extended operation</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-cyan-400 font-bold mt-1">✓</span>
                    <span>Automatic loop closure detection and map correction</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-slate-400 font-bold mt-1">⚠</span>
                    <span>Requires adequate lighting and visual features</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-slate-400 font-bold mt-1">⚠</span>
                    <span>Higher computational requirements</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Team Section */}
        <section
          ref={teamRef}
          className="min-h-screen flex items-center justify-center relative px-4 sm:px-6 md:px-10 py-12 bg-gradient-to-b from-transparent via-purple-500/5 to-transparent"
        >
          <div className="max-w-7xl w-full">
            <div className="mb-12">
              <div className="flex items-center gap-3 mb-4">
                <span className="divider-dot" />
                <p className="text-xs sm:text-sm uppercase tracking-[0.2em] text-purple-200/80">
                  Contributors
                </p>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">Meet the Team</h2>
              <p className="text-sm sm:text-base text-slate-200/85 max-w-3xl">
                The talented team behind SLAM the Dead, working together to bring you cutting-edge spatial navigation and computer vision technology.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {CONTRIBUTORS.map((contributor) => (
                <div
                  key={contributor.name}
                  className="group module-card rounded-2xl p-6 sm:p-8 flex flex-col items-center text-center hover:scale-105 transition-transform duration-300"
                >
                  <div className="text-5xl sm:text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">
                    {contributor.icon}
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold mb-2">{contributor.name}</h3>
                  <p className="text-emerald-300 text-xs sm:text-sm font-semibold mb-3">
                    {contributor.role}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    {contributor.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-12 module-card rounded-3xl p-6 sm:p-8">
              <h3 className="text-xl sm:text-2xl font-bold mb-4 text-emerald-300">Special Thanks</h3>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                This project builds upon years of research in visual SLAM, inertial measurement systems, and robotics navigation. 
                We're grateful to the open-source community for their contributions and inspiration.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer ref={footerRef} className="bg-black/60 border-t border-white/10 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-6 mb-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img src="/LOGO2.png" alt="SLAM the Dead" className="h-8 w-auto" />
                <span className="text-sm font-semibold text-emerald-300">SLAM the Dead</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400">
                Spatial navigation lab for autonomous systems
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Quick Links</h4>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-400">
                <li>
                  <button
                    onClick={() => scrollToSection(heroRef)}
                    className="hover:text-emerald-300 transition"
                  >
                    Home
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection(drRef)}
                    className="hover:text-emerald-300 transition"
                  >
                    DR Module
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection(slamRef)}
                    className="hover:text-emerald-300 transition"
                  >
                    SLAM Module
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection(comparisonRef)}
                    className="hover:text-emerald-300 transition"
                  >
                    Comparison
                  </button>
                </li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Resources</h4>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-400">
                <li>
                  <button
                    onClick={() => scrollToSection(teamRef)}
                    className="hover:text-emerald-300 transition"
                  >
                    Team
                  </button>
                </li>
                <li>
                  <a href="#" className="hover:text-emerald-300 transition">
                    Documentation
                  </a>
                </li>
                <li>
                  <a href="https://github.com/Dhruvil05Patel/SLAM-the-Dead" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-300 transition">
                    GitHub
                  </a>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Contact</h4>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-400">
                <li>
                  <a href="mailto:dhruvil1405patel@gmail.com" className="hover:text-emerald-300 transition">
                    dhruvil1405patel@gmail.com
                  </a>
                </li>
                <li>
                  <a href="https://github.com/Dhruvil05Patel/SLAM-the-Dead/issues" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-300 transition">
                    GitHub Issues
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Footer Bottom */}
          <div className="border-t border-white/10 pt-6 sm:pt-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs sm:text-sm text-slate-500">
                © 2025 SLAM the Dead. All rights reserved.
              </p>
              <div className="flex gap-4 text-xs sm:text-sm">
                <a href="#" className="text-slate-500 hover:text-emerald-300 transition">
                  Privacy Policy
                </a>
                <span className="text-slate-600">•</span>
                <a href="#" className="text-slate-500 hover:text-emerald-300 transition">
                  Terms of Service
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
