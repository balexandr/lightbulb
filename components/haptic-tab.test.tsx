import { Text } from 'react-native';

import { PlatformPressable } from '@react-navigation/elements';
import { NavigationContainer } from '@react-navigation/native';
import { render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import { HapticTab } from './haptic-tab';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

// Renders the tab and returns the wrapped onPressIn handler HapticTab builds,
// bypassing PlatformPressable's own gesture/timing internals so this stays a
// unit test of HapticTab's logic rather than of the gesture responder system.
function getWrappedOnPressIn(onPressIn: () => void) {
  render(
    <NavigationContainer>
      <HapticTab accessibilityRole="button" onPressIn={onPressIn}>
        <Text>Tab</Text>
      </HapticTab>
    </NavigationContainer>
  );
  const pressable = screen.UNSAFE_getByType(PlatformPressable);
  return pressable.props.onPressIn as (event: unknown) => void;
}

// babel-preset-expo constant-folds `process.env.EXPO_OS` to a literal at
// transform time based on the Jest project's platform (ios here), so
// reassigning it at runtime has no effect on the compiled `if` check below.
// That makes the "ios" branch the only one this Jest config can exercise;
// the non-iOS branch would need a separate jest-expo "android"/"web" project.
describe('HapticTab', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('triggers a light haptic on pressIn', () => {
    const wrappedOnPressIn = getWrappedOnPressIn(jest.fn());

    wrappedOnPressIn({});

    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });

  it('still calls the caller-provided onPressIn handler', () => {
    const onPressIn = jest.fn();
    const wrappedOnPressIn = getWrappedOnPressIn(onPressIn);

    const event = { nativeEvent: {} };
    wrappedOnPressIn(event);

    expect(onPressIn).toHaveBeenCalledWith(event);
  });
});
