import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabBarBackground() {
  const colorScheme = useColorScheme() ?? 'light';
  
  return (
    <BlurView
      tint={colorScheme}
      intensity={100}
      style={StyleSheet.absoluteFill}
    />
  );
}