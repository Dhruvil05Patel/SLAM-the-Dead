import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText } from '../components/ThemedText';
import ThemedView from '../components/ThemedView';

const HomeScreen: React.FC = () => {
  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>SLAM × DR Playground</ThemedText>
      <ThemedText style={styles.subtitle}>Explore Dead Reckoning, SLAM, and compare both.</ThemedText>

      <View style={styles.cardGrid}>
        <View style={styles.card}> 
          <ThemedText style={styles.cardTitle}>Dead Reckoning</ThemedText>
          <ThemedText style={styles.cardText}>Step-based PDR with fused heading.</ThemedText>
        </View>
        <View style={styles.card}> 
          <ThemedText style={styles.cardTitle}>Visual SLAM</ThemedText>
          <ThemedText style={styles.cardText}>ARCore / ORB-SLAM3 when available.</ThemedText>
        </View>
        <View style={styles.cardWide}> 
          <ThemedText style={styles.cardTitle}>Compare</ThemedText>
          <ThemedText style={styles.cardText}>Track both and visualize drift.</ThemedText>
        </View>
      </View>

      <ThemedText style={styles.sectionTitle}>Tips</ThemedText>
      <ThemedText style={styles.tip}>• Hold still ~30–60s at start for gyro calibration.</ThemedText>
      <ThemedText style={styles.tip}>• Walk naturally; the path updates per step.</ThemedText>
      <ThemedText style={styles.tip}>• Avoid magnets/metal for stable heading.</ThemedText>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 28, fontWeight: 'bold', marginTop: 8 },
  subtitle: { fontSize: 16, opacity: 0.7, marginBottom: 16 },
  cardGrid: { gap: 10 },
  card: { backgroundColor: 'rgba(0,122,255,0.08)', padding: 16, borderRadius: 10 },
  cardWide: { backgroundColor: 'rgba(76,175,80,0.08)', padding: 16, borderRadius: 10 },
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 6 },
  cardText: { fontSize: 14, opacity: 0.9 },
  sectionTitle: { fontSize: 20, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  tip: { fontSize: 14, opacity: 0.85, marginBottom: 4 },
});

export default HomeScreen;
