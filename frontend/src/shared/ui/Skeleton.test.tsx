import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SKELETON_DELAY_MS, SkeletonBlock, SkeletonRegion } from './Skeleton';

describe('SkeletonRegion', () => {
  it('is announced once, as loading what it stands for', () => {
    render(
      <SkeletonRegion label="tools">
        <SkeletonBlock />
      </SkeletonRegion>,
    );
    const region = screen.getByRole('status', { name: 'Loading tools' });
    expect(region.getAttribute('aria-busy')).toBe('true');
  });

  it('stays invisible for its first 150ms, so a fast load never shows it', () => {
    render(
      <SkeletonRegion label="tools">
        <SkeletonBlock />
      </SkeletonRegion>,
    );
    expect(SKELETON_DELAY_MS).toBe(150);
    expect(screen.getByRole('status').style.animationDelay).toBe('150ms');
  });
});

describe('SkeletonBlock', () => {
  it('fades in after the region, staggered by its order, and shares one shimmer', () => {
    const { container } = render(<SkeletonBlock order={2} />);
    const block = container.firstElementChild as HTMLElement;
    expect(block.style.animationDelay).toBe('210ms, 0ms');
    expect(block.getAttribute('aria-hidden')).toBe('true');
  });
});
