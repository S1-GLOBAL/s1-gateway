import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ILLUSTRATIVE, ILLUSTRATIVE_V2, readCode } from '../../application/testing/atlas-fixtures';
import type { DecodedSpecId } from '../../domain/atlas';
import { CodePanel, COPIED_MS } from './CodePanel';

/** The illustrative lid, its code as written today. */
const lid: DecodedSpecId = { ...readCode(ILLUSTRATIVE), code: ILLUSTRATIVE_V2 };

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('CodePanel', () => {
  it('shows the code, that facts not known are left out of it, and the known facts in plain words', () => {
    render(<CodePanel decoded={lid} />);
    expect(screen.getByText((_, element) => element?.tagName === 'P' && element.textContent === ILLUSTRATIVE_V2)).toBeTruthy();
    expect(screen.getByText('Facts not known are left out.')).toBeTruthy();
    expect(screen.queryByText('Not known yet')).toBeNull();
    expect(screen.queryByText("Doesn't apply")).toBeNull();
    expect(screen.getByText('Bowl lid · APS · CL · RD · DM · Top diameter 0090 · Unit weight 0033')).toBeTruthy();
  });

  it('writes the code in one style: no letter, number or hyphen looks different from the rest', () => {
    render(<CodePanel decoded={lid} />);
    const code = screen.getByText(ILLUSTRATIVE_V2);
    expect(code.tagName).toBe('P');
    expect(code.children).toHaveLength(0);
  });

  it('copies the code, reads "Copied", and reads "Copy" again after 2 seconds', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<CodePanel decoded={lid} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });

    expect(writeText).toHaveBeenCalledWith(ILLUSTRATIVE_V2);
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
