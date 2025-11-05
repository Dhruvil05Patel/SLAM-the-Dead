import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { ThemeProvider } from './theme/ThemeContext';
import HomeScreen from './app/(tabs)/Home';
import DeadReckoningScreen from './app/(tabs)/DR';
import SlamScreen from './app/(tabs)/SLAM';
import CompareScreen from './app/(tabs)/Compare';

type TabKey = 'home' | 'dr' | 'slam' | 'compare';

const TabBar = ({ active, setActive }: { active: TabKey; setActive: (k: TabKey) => void }) => {
  const TabButton = ({ label, tab }: { label: string; tab: TabKey }) => (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={() => setActive(tab)}
      style={[styles.tabButton, active === tab && styles.tabButtonActive]}
    >
      <Text style={[styles.tabLabel, active === tab && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={styles.tabBar}>
      <TabButton label="Home" tab="home" />
      <TabButton label="DR" tab="dr" />
      <TabButton label="SLAM" tab="slam" />
      <TabButton label="Compare" tab="compare" />
    </View>
  );
};

export default function App() {
  const [active, setActive] = useState<TabKey>('home');

  const renderScreen = () => {
    switch (active) {
      case 'dr':
        return <DeadReckoningScreen />;
      case 'slam':
        return <SlamScreen />;
      case 'compare':
        return <CompareScreen />;
      case 'home':
      default:
        return <HomeScreen />;
    }
  };

  return (
    <ThemeProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        <View style={styles.content}>{renderScreen()}</View>
        <TabBar active={active} setActive={setActive} />
      </SafeAreaView>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    height: 56,
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
    backgroundColor: '#fafafa',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  tabLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#111',
  },
});
