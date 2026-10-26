import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';
import { Button } from './Button';
import { Logo, SourceOneName } from './Logo';
import { TextField } from './TextField';

describe('Button', () => {
  it('is a plain button by default', () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.getAttribute('type')).toBe('button');
    expect(button.hasAttribute('disabled')).toBe(false);
  });

  it('is busy and cannot be pressed while loading', () => {
    render(<Button loading>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.hasAttribute('disabled')).toBe(true);
  });
});

describe('Logo', () => {
  it('is announced as Source One', () => {
    render(<Logo />);
    expect(screen.getByRole('img', { name: 'Source One' })).toBeTruthy();
  });

  it('keeps the artwork proportions at any height', () => {
    render(<Logo variant="mark" height={42.4} />);
    const logo = screen.getByRole('img', { name: 'Source One' });
    expect(logo.style.width).toBe('59px');
  });
});

describe('SourceOneName', () => {
  it('writes the name in the door face, a step above a sidebar label', () => {
    render(<SourceOneName />);
    const name = screen.getByText('Source One');
    expect(name.className).toContain('font-mono');
    expect(name.className).toContain('text-md');
    expect(screen.queryByRole('img', { name: 'Source One' })).toBeNull();
  });
});

describe('Badge', () => {
  it('uses the accent ink for the accent tone, never the fill', () => {
    render(<Badge tone="accent">New</Badge>);
    expect(screen.getByText('New').className).toContain('text-accent-ink');
  });
});

describe('TextField', () => {
  it('keeps the same input, and its focus, when its action appears', () => {
    const { rerender } = render(<TextField label="Search" action={null} />);
    const input = screen.getByLabelText('Search');
    input.focus();

    rerender(<TextField label="Search" action={<Button>Go</Button>} />);

    expect(screen.getByLabelText('Search')).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(screen.getByRole('button', { name: 'Go' })).toBeTruthy();
  });
});
