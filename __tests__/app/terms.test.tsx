import { render, screen } from '@testing-library/react-native';

import TermsOfServiceScreen from '@/app/terms';

describe('TermsOfServiceScreen', () => {
  it('renders the terms title and the AI-accuracy disclaimer', () => {
    render(<TermsOfServiceScreen />);

    expect(screen.getByText('Terms of Service')).toBeTruthy();
    expect(screen.getByText(/may be incomplete, out of date, or factually incorrect/)).toBeTruthy();
  });
});
