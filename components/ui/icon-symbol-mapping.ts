import { ComponentProps } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolViewProps } from 'expo-symbols';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;

// In its own file (not named icon-symbol*) so it can be imported
// unambiguously from tests - a bare `./icon-symbol` specifier resolves to
// icon-symbol.ios.tsx under Jest's RN-style platform resolution, silently
// skipping this mapping entirely (and `tsc` does the same, which is how a
// missing entry here - 'gearshape.fill', the Preferences tab icon - went
// unnoticed: invisible on web/Android, fine on iOS, no type error either).
//
// Add your SF Symbols to Material Icons mappings here.
// - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
// - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
export const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'gearshape.fill': 'settings',
} as IconMapping;
