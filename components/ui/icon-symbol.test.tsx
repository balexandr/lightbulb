import { MAPPING } from './icon-symbol-mapping';

// Every SF Symbol name actually used in the app (tab bar icons, etc.) - see
// grep for `<IconSymbol` across app/ and components/. icon-symbol.tsx (the
// web/Android fallback) only renders a symbol if it's in MAPPING; unlike
// icon-symbol.ios.tsx (real SF Symbols, any name works), a name missing
// here silently renders nothing rather than erroring. This test is the
// actual guardrail: it fails if any name currently used in the app doesn't
// map to a MaterialIcons name (confirmed bug: 'gearshape.fill', the
// Preferences tab icon, was missing and silently invisible on web/Android).
const NAMES_USED_IN_APP = ['house.fill', 'gearshape.fill'] as const;

describe('IconSymbol MAPPING (web/Android MaterialIcons fallback)', () => {
  it.each(NAMES_USED_IN_APP)('has a MaterialIcons mapping for "%s"', name => {
    expect(MAPPING[name]).toBeTruthy();
  });
});
