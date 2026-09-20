import { render, screen } from '@testing-library/react-native';

import PrivacyPolicyScreen from '@/app/privacy';

describe('PrivacyPolicyScreen', () => {
  it('renders the policy title and key disclosures', () => {
    render(<PrivacyPolicyScreen />);

    expect(screen.getByText('Privacy Policy')).toBeTruthy();
    expect(screen.getByText(/Anthropic/)).toBeTruthy();
    expect(screen.getByText(/Upstash/)).toBeTruthy();
  });
});
