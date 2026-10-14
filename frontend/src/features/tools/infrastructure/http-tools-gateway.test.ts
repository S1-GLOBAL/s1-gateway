import axios, { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import { AppError } from '@/shared/application/app-error';
import { HttpToolsGateway } from './http-tools-gateway';

const wireTool = {
  id: 't1',
  name: 'Payroll',
  url: 'https://payroll.example.com',
  description: '',
  category: 'Finance',
  createdAt: '2026-10-14T08:00:00.000Z',
};

function gatewayAnswering(status: number, data: unknown, sent: unknown[] = []): HttpToolsGateway {
  const adapter: AxiosAdapter = async (config) => {
    sent.push(config.data === undefined ? undefined : JSON.parse(config.data as string));
    const response: AxiosResponse = { data, status, statusText: String(status), headers: {}, config };
    if (status >= 400) throw new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, response);
    return response;
  };
  return new HttpToolsGateway(axios.create({ adapter }));
}

describe('HttpToolsGateway', () => {
  it('lists tools with their creation time as a Date', async () => {
    const [tool] = await gatewayAnswering(200, { data: [wireTool] }).list();
    expect(tool?.createdAt).toEqual(new Date('2026-10-14T08:00:00.000Z'));
    expect(tool?.name).toBe('Payroll');
  });

  it('sends the new tool and returns what was created', async () => {
    const sent: unknown[] = [];
    const created = await gatewayAnswering(201, { data: wireTool }, sent).create({
      name: 'Payroll',
      url: 'https://payroll.example.com',
      description: '',
      category: 'Finance',
    });
    expect(sent).toEqual([{ name: 'Payroll', url: 'https://payroll.example.com', description: '', category: 'Finance' }]);
    expect(created.id).toBe('t1');
  });

  it('rejects with an AppError carrying the API error', async () => {
    const gateway = gatewayAnswering(409, {
      error: { code: 'TOOL_NAME_TAKEN', message: 'Taken.', details: { fields: { name: ['Taken.'] } } },
    });
    const failure = await gateway.list().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AppError);
    expect((failure as AppError).code).toBe('TOOL_NAME_TAKEN');
  });

  it('rejects with NETWORK when the server cannot be reached', async () => {
    const adapter: AxiosAdapter = async (config) => {
      throw new AxiosError('Network Error', 'ERR_NETWORK', config);
    };
    const failure = await new HttpToolsGateway(axios.create({ adapter })).list().catch((error: unknown) => error);
    expect((failure as AppError).code).toBe('NETWORK');
  });
});
