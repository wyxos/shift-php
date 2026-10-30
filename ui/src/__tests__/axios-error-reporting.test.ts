import { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import client from '../axios-config';
import { installWorkspaceErrorReporting } from '../error-reporting';

describe('SDK Axios reporting', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('reports a caught API failure and retains the rejection for existing recovery UI', async () => {
        window.shiftConfig = { errorReportingEnabled: true } as Window['shiftConfig'];
        const stop = installWorkspaceErrorReporting();
        const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
        vi.stubGlobal('fetch', fetchMock);
        let correlation: string | undefined;

        try {
            await expect(client.get('/shift/api/tasks', {
                adapter: (config) => {
                    correlation = String(config.headers.get('X-Shift-Correlation-ID'));
                    return Promise.reject(new AxiosError('Fixture load failed', 'ERR_BAD_RESPONSE', config, null, {
                        status: 503, statusText: 'Unavailable', config, data: {},
                        headers: new AxiosHeaders({ 'x-shift-correlation-id': correlation }),
                    }));
                },
            })).rejects.toThrow('Fixture load failed');

            expect(correlation).toMatch(/^[0-9a-f-]{36}$/);
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock.mock.calls[0][1].headers['X-Shift-Correlation-ID']).toBe(correlation);
            expect(JSON.parse(fetchMock.mock.calls[0][1].body).context).toMatchObject({
                operation: 'GET /shift/api/tasks', correlation_id: correlation, http_status: 503,
            });
        } finally {
            stop();
        }
    });

    it('retains the originating request correlation when no response was received', async () => {
        window.shiftConfig = { errorReportingEnabled: true } as Window['shiftConfig'];
        const stop = installWorkspaceErrorReporting();
        const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
        vi.stubGlobal('fetch', fetchMock);
        let correlation: string | undefined;

        try {
            await expect(client.get('/shift/api/tasks/42', {
                adapter: (config) => {
                    correlation = String(config.headers.get('X-Shift-Correlation-ID'));
                    return Promise.reject(new AxiosError('Fixture network failed', 'ERR_NETWORK', config));
                },
            })).rejects.toThrow('Fixture network failed');

            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock.mock.calls[0][1].headers['X-Shift-Correlation-ID']).toBe(correlation);
            expect(JSON.parse(fetchMock.mock.calls[0][1].body).context).toMatchObject({
                operation: 'GET /shift/api/tasks/:id', correlation_id: correlation,
            });
        } finally {
            stop();
        }
    });
});
