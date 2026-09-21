import { configure } from '@testing-library/react-native';

// Default is 1000ms, which a slower/shared CI runner can blow past on a
// component's first render+fetch+state-update cycle even though nothing is
// actually broken - confirmed via a passing local run (~426ms) that still
// failed deterministically on GitHub Actions. Not needed for anything
// actually hung or broken, just headroom for CI hardware being slower.
// Must load via setupFilesAfterEnv, not setupFiles - this runs after the
// test framework (expect, etc.) is installed, which @testing-library's
// import needs.
//
// Jest's own per-test timeout defaults to 5000ms too (see package.json's
// jest.testTimeout, bumped to 10000) - without headroom above this value, a
// waitFor that legitimately takes close to 5000ms on a slow CI runner blows
// the *outer* test timeout instead of this one, which is the same failure
// mode with a more confusing error message.
configure({ asyncUtilTimeout: 5000 });
