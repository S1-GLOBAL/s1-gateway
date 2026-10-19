import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ILLUSTRATIVE, readCode } from '../../application/testing/atlas-fixtures';
import { CodePanel, COPIED_MS } from './CodePanel';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('CodePanel', () => {
  it('shows the code, a key to its markers and the known facts in plain words', () => {
    render(<CodePanel decoded={readCode(ILLUSTRATIVE)} />);
    expect(screen.getByText((_, element) => element?.tagName === 'P' && element.textContent === ILLUSTRATIVE)).toBeTruthy();
    expect(screen.queryByText('Known')).toBeNull();
    expect(screen.getByText('Not known yet')).toBeTruthy();
    expect(screen.getByText("Doesn't apply")).toBeTruthy();
    expect(screen.getByText('Bowl lid · APS · CL · RD · DM · 0090 · 0033')).toBeTruthy();
  });

  it('writes the code in one style: no part, marker or dot looks different from the rest', () => {
    render(<CodePanel decoded={readCode(ILLUSTRATIVE)} />);
    const code = screen.getByText(ILLUSTRATIVE);
    expect(code.tagName).toBe('P');
    expect(code.children).toHaveLength(0);
  });

  it('copies the code, reads "Copied", and reads "Copy" again after 2 seconds', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<CodePanel decoded={readCode(ILLUSTRATIVE)} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });

    expect(writeText).toHaveBeenCalledWith(ILLUSTRATIVE);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
    act(() => vi.advanceTimersByTime(COPIED_MS - 1));
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    expect(COPIED_MS).toBe(2000);
  });

  it('cannot copy before the first code arrives', () => {
    render(<CodePanel decoded={undefined} />);
    expect((screen.getByRole('button', { name: 'Copy' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
