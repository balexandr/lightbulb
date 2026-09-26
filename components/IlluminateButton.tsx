import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';

import { AccentColor } from '@/constants/theme';

interface IlluminateButtonProps {
  onPress: () => void;
}

// A hover-only flourish for web/mouse users: the button "lights up"
// (stronger background) and scales up slightly on hover. No emoji
// swapping - keep the icon fixed, that kind of cutesy micro-animation
// reads as generic AI-generated UI. Pressable's onHoverIn/onHoverOut
// simply never fire without a mouse, so this is inert on iOS/Android - no
// separate touch-platform branch needed.
export function IlluminateButton({ onPress }: IlluminateButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number) => {
    Animated.spring(scale, { toValue, useNativeDriver: true, friction: 5, tension: 140 }).start();
  };

  return (
    <Pressable
      testID="illuminate-button"
      onPress={onPress}
      onHoverIn={() => {
        setIsHovered(true);
        animateTo(1.08);
      }}
      onHoverOut={() => {
        setIsHovered(false);
        animateTo(1);
      }}
      style={[styles.button, isHovered && styles.buttonHovered]}
    >
      <Animated.View style={[styles.row, { transform: [{ scale }] }]}>
        <MaterialIcons name="lightbulb" size={14} color={AccentColor} />
        <Text style={styles.text}>Illuminate</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    marginLeft: 8,
  },
  buttonHovered: {
    backgroundColor: 'rgba(255, 193, 7, 0.35)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: AccentColor,
  },
});
