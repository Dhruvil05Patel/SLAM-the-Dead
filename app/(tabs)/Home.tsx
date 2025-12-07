import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { ThemedText } from '../components/ThemedText';
import ThemedView from '../components/ThemedView';

const HomeScreen: React.FC = () => {
  return (
    <ScrollView style={{ flex: 1 }}>
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>🎯 SLAM the Dead</ThemedText>
          <ThemedText style={styles.subtitle}>Compare Dead Reckoning vs Visual SLAM</ThemedText>
        </View>

        <View style={styles.description}>
          <ThemedText style={styles.descriptionText}>
            This app demonstrates the difference between Dead Reckoning (DR) and Simultaneous Localization and Mapping (SLAM) 
            for indoor navigation. Track your movement using device sensors and compare accuracy.
          </ThemedText>
        </View>

        <View style={styles.cardGrid}>
          <View style={[styles.card, styles.drCard]}> 
            <ThemedText style={styles.cardIcon}>📱</ThemedText>
            <ThemedText style={styles.cardTitle}>Dead Reckoning</ThemedText>
            <ThemedText style={styles.cardText}>Uses accelerometer, gyroscope, and magnetometer for step-based pedestrian dead reckoning with orientation fusion.</ThemedText>
          </View>
          <View style={[styles.card, styles.slamCard]}> 
            <ThemedText style={styles.cardIcon}>📷</ThemedText>
            <ThemedText style={styles.cardTitle}>Visual SLAM</ThemedText>
            <ThemedText style={styles.cardText}>Camera-based tracking using ARCore or ORB-SLAM3 for visual-inertial odometry and mapping.</ThemedText>
          </View>
          <View style={[styles.card, styles.compareCard]}> 
            <ThemedText style={styles.cardIcon}>📊</ThemedText>
            <ThemedText style={styles.cardTitle}>Comparison Mode</ThemedText>
            <ThemedText style={styles.cardText}>Run both algorithms simultaneously and visualize trajectory drift and accuracy metrics.</ThemedText>
          </View>
        </View>

        <View style={styles.tipsSection}>
          <ThemedText style={styles.sectionTitle}>💡 Pro Tips</ThemedText>
          <View style={styles.tipContainer}>
            <ThemedText style={styles.tip}>🔹 Hold device still for 5-10 seconds at start for sensor calibration</ThemedText>
            <ThemedText style={styles.tip}>🔹 Walk naturally at normal pace for best step detection</ThemedText>
            <ThemedText style={styles.tip}>🔹 Keep device in portrait orientation during tracking</ThemedText>
            <ThemedText style={styles.tip}>🔹 Avoid magnetic interference from metal objects</ThemedText>
            <ThemedText style={styles.tip}>🔹 SLAM works best in well-lit environments with visual features</ThemedText>
          </View>
        </View>

        <View style={styles.getStarted}>
          <ThemedText style={styles.getStartedTitle}>🚀 Get Started</ThemedText>
          <ThemedText style={styles.getStartedText}>
            Select a tab above to begin tracking. Start with Dead Reckoning to test sensor-based tracking, 
            or jump to Compare mode to see both methods side-by-side.
          </ThemedText>
        </View>
      </ThemedView>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  title: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    marginTop: 8,
    textAlign: 'center',
  },
  subtitle: { 
    fontSize: 16, 
    opacity: 0.7, 
    marginTop: 8,
    textAlign: 'center',
  },
  description: {
    backgroundColor: 'rgba(0,122,255,0.05)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: 'rgba(0,122,255,0.5)',
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  cardGrid: { 
    gap: 16,
    marginBottom: 20,
  },
  card: { 
    padding: 20, 
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  drCard: {
    backgroundColor: 'rgba(0,122,255,0.08)',
  },
  slamCard: {
    backgroundColor: 'rgba(76,175,80,0.08)',
  },
  compareCard: {
    backgroundColor: 'rgba(255,152,0,0.08)',
  },
  cardIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  cardTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    marginBottom: 8,
  },
  cardText: { 
    fontSize: 14, 
    opacity: 0.85,
    lineHeight: 20,
  },
  tipsSection: {
    marginBottom: 20,
  },
  sectionTitle: { 
    fontSize: 22, 
    fontWeight: '700', 
    marginBottom: 12,
  },
  tipContainer: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    padding: 16,
    borderRadius: 12,
  },
  tip: { 
    fontSize: 14, 
    opacity: 0.85, 
    marginBottom: 8,
    lineHeight: 20,
  },
  getStarted: {
    backgroundColor: 'rgba(76,175,80,0.08)',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(76,175,80,0.2)',
  },
  getStartedTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  getStartedText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.85,
  },
});

export default HomeScreen;
