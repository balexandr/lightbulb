import { fireEvent, render, screen } from '@testing-library/react-native';

import { CoverageComparisonModal } from './CoverageComparisonModal';
import { NewsItem } from '@/types/news';

function makeItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: 'id-1',
    title: 'A headline',
    url: 'https://example.com/a',
    source: { name: 'BBC', type: 'rss' },
    publishedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

describe('CoverageComparisonModal', () => {
  it('renders nothing when there is no main item', () => {
    render(
      <CoverageComparisonModal visible mainItem={null} relatedItems={[]} onClose={jest.fn()} onOpenArticle={jest.fn()} />
    );
    expect(screen.queryByText('Coverage Comparison')).toBeNull();
  });

  it('lists the main item and every related item, each with its source', () => {
    const mainItem = makeItem({ id: 'bbc', title: 'BBC headline', source: { name: 'BBC', type: 'rss' } });
    const related = [
      makeItem({ id: 'npr', title: 'NPR headline', source: { name: 'NPR', type: 'rss' } }),
      makeItem({ id: 'guardian', title: 'Guardian headline', source: { name: 'The Guardian', type: 'rss' } }),
    ];

    render(
      <CoverageComparisonModal
        visible
        mainItem={mainItem}
        relatedItems={related}
        onClose={jest.fn()}
        onOpenArticle={jest.fn()}
      />
    );

    expect(screen.getByText('BBC headline')).toBeTruthy();
    expect(screen.getByText('NPR headline')).toBeTruthy();
    expect(screen.getByText('Guardian headline')).toBeTruthy();
    expect(screen.getByText(/3 outlets are covering a story like this one/)).toBeTruthy();
  });

  it('opens the article when a card is tapped', () => {
    const mainItem = makeItem({ url: 'https://example.com/main' });
    const onOpenArticle = jest.fn();

    render(
      <CoverageComparisonModal
        visible
        mainItem={mainItem}
        relatedItems={[]}
        onClose={jest.fn()}
        onOpenArticle={onOpenArticle}
      />
    );

    fireEvent.press(screen.getByText('A headline'));
    expect(onOpenArticle).toHaveBeenCalledWith(mainItem);
  });

  it('calls onClose when the close button is pressed', () => {
    const onClose = jest.fn();
    render(
      <CoverageComparisonModal visible mainItem={makeItem()} relatedItems={[]} onClose={onClose} onOpenArticle={jest.fn()} />
    );

    fireEvent.press(screen.UNSAFE_getByProps({ name: 'close' }).parent);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
