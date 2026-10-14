import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/application/app-error';
import type { ToolsGateway } from '../application/tools-gateway';
import { ToolsGatewayProvider } from '../application/tools-gateway-context';
import type { NewTool, Tool } from '../domain/tool';
import { CreateToolForm } from './CreateToolForm';

function renderForm(create: ToolsGateway['create']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const gateway: ToolsGateway = { list: async () => [], create };
  render(
    <QueryClientProvider client={queryClient}>
      <ToolsGatewayProvider gateway={gateway}>
        <CreateToolForm />
      </ToolsGatewayProvider>
    </QueryClientProvider>,
  );
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function submitPayroll() {
  fill('Name', 'Payroll');
  fill('URL', 'https://payroll.example.com');
  fill('Category', 'Finance');
  fireEvent.click(screen.getByRole('button', { name: 'Add tool' }));
}

describe('CreateToolForm', () => {
  it('sends the entered tool and clears the form', async () => {
    const create = vi.fn(async (input: NewTool): Promise<Tool> => ({ ...input, id: 't1', createdAt: new Date() }));
    renderForm(create);
    submitPayroll();

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        name: 'Payroll',
        url: 'https://payroll.example.com',
        description: '',
        category: 'Finance',
      }),
    );
    await waitFor(() => expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe(''));
  });

  it("shows the server's message under the field it is about, and keeps the input", async () => {
    const message = 'A tool named "Payroll" already exists.';
    renderForm(async () => {
      throw new AppError('TOOL_NAME_TAKEN', message, { name: [message] });
    });
    submitPayroll();

    expect(await screen.findByText(message)).toBeTruthy();
    const name = screen.getByLabelText('Name') as HTMLInputElement;
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(name.value).toBe('Payroll');
  });

  it('shows a general message when the failure is not about a field', async () => {
    renderForm(async () => {
      throw new AppError('NETWORK', 'Cannot reach the server. Check your connection and try again.');
    });
    submitPayroll();

    expect((await screen.findByRole('alert')).textContent).toMatch(/cannot reach the server/i);
  });
});
