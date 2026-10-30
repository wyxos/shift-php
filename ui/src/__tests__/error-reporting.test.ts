import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import {
    configureWorkspaceErrorReporting,
    installWorkspaceErrorReporting,
    reportWorkspaceError,
    reportWorkspaceRequestError,
} from '../error-reporting';

describe('workspace error reporting', () => {
    let stop: () => void;
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));

    beforeEach(() => {
        vi.stubGlobal('fetch', fetchMock);
        window.shiftConfig = {
            errorReportingEnabled: true,
            errorReportingEndpoint: '/shift/api/errors',
            csrfToken: 'fixture-csrf',
        } as Window['shiftConfig'];
        stop = installWorkspaceErrorReporting();
    });

    afterEach(() => {
        stop();
        vi.unstubAllGlobals();
        fetchMock.mockClear();
        document.body.innerHTML = '';
    });

    function lastPayload() {
        return JSON.parse(fetchMock.mock.calls.at(-1)![1].body);
    }

    it('attaches the loaded frontend identity independently of consumer runtime configuration', () => {
        vi.stubGlobal('__SHIFT_UI_BUILD_ID__', 'a'.repeat(64));
        vi.stubGlobal('__SHIFT_UI_SDK_REVISION__', 'b'.repeat(40));
        reportWorkspaceError(new Error('Build identity fixture'), { operation: 'runtime' });
        expect(lastPayload()).toMatchObject({ frontend_build_id: 'a'.repeat(64), frontend_sdk_revision: 'b'.repeat(40) });
    });

    it('captures a real Vue render exception with component and operation context', () => {
        const error = new Error('Fixture render failed');
        const fail = (): never => { throw error; };
        const app = createApp({ name: 'BrokenWorkspace', render: () => h('div', fail()) });
        const router = createRouter({ history: createMemoryHistory(), routes: [] });
        configureWorkspaceErrorReporting(app, router);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const root = document.createElement('div');
        document.body.append(root);

        app.mount(root);

        expect(lastPayload()).toMatchObject({
            source: 'ui', error: { name: 'Error', message: 'Fixture render failed' },
            context: { operation: expect.stringContaining('vue:'), component: 'BrokenWorkspace' },
        });
        expect(fetchMock.mock.calls[0][1].headers['X-CSRF-TOKEN']).toBe('fixture-csrf');
        app.unmount();
        vi.restoreAllMocks();
    });

    it('reports runtime and unhandled promise errors only when SDK assets identify their source', () => {
        const unrelated = new Error('Consumer failure');
        window.dispatchEvent(new ErrorEvent('error', { error: unrelated, filename: '/consumer.js' }));
        expect(fetchMock).not.toHaveBeenCalled();

        const runtime = new Error('Fixture runtime failed');
        window.dispatchEvent(new ErrorEvent('error', { error: runtime, filename: '/shift-assets/assets/workspace.js' }));
        expect(lastPayload().context.operation).toBe('runtime');

        const promise = new Error('Fixture promise failed');
        promise.stack = 'Error: Fixture promise failed\n at https://consumer.test/shift-assets/assets/workspace.js:4:8';
        const event = new Event('unhandledrejection');
        Object.defineProperty(event, 'reason', { value: promise });
        window.dispatchEvent(event);
        expect(lastPayload().context.operation).toBe('promise');

        const extension = new Error('Extension failed');
        extension.stack = 'chrome-extension://example/shift-assets/workspace.js:1:1';
        const extensionEvent = new Event('unhandledrejection');
        Object.defineProperty(extensionEvent, 'reason', { value: extension });
        window.dispatchEvent(extensionEvent);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('captures failed SDK assets and ignores consumer assets', () => {
        const script = document.createElement('script');
        script.src = '/shift-assets/assets/missing.js';
        document.body.append(script);
        script.dispatchEvent(new Event('error'));
        expect(lastPayload().context.operation).toBe('asset');

        const other = document.createElement('script');
        other.src = '/consumer-missing.js';
        document.body.append(other);
        other.dispatchEvent(new Event('error'));
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('captures navigation errors through the actual router error callback', async () => {
        const error = new Error('Fixture chunk failed');
        const router = createRouter({
            history: createMemoryHistory(),
            routes: [{ path: '/broken', component: () => Promise.reject(error) }],
        });
        configureWorkspaceErrorReporting(createApp({ render: () => h('div') }), router);
        await expect(router.push('/broken')).rejects.toThrow('Fixture chunk failed');
        expect(lastPayload().context.operation).toBe('navigation');
    });

    it('captures handled SDK request failures without serializing request bodies or queries', () => {
        const error = Object.assign(new Error('Fixture API failed'), {
            config: { method: 'post', url: '/shift/api/tasks?token=private', data: { description: 'private draft' } },
            response: { status: 503, headers: { 'x-shift-correlation-id': '10000000-0000-4000-8000-000000000001' } },
        });
        reportWorkspaceRequestError(error);
        expect(lastPayload().context).toMatchObject({
            operation: 'POST /shift/api/tasks', http_status: 503, correlation_id: '10000000-0000-4000-8000-000000000001',
        });
        expect(fetchMock.mock.calls[0][1].headers['X-Shift-Correlation-ID']).toBe('10000000-0000-4000-8000-000000000001');
        expect(fetchMock.mock.calls[0][1].body).not.toContain('private');
    });

    it('ignores expected HTTP failures, cancellation, reporting requests, and backend-reported exceptions', () => {
        for (const status of [400, 401, 403, 404, 419, 422, 429]) {
            reportWorkspaceRequestError({ config: { url: '/shift/api/tasks' }, response: { status } });
        }
        reportWorkspaceRequestError({ code: 'ERR_CANCELED', config: { url: '/shift/api/tasks' } });
        reportWorkspaceRequestError({ config: { url: '/shift/api/errors' }, response: { status: 500 } });
        reportWorkspaceRequestError({ config: { url: 'https://elsewhere.test/shift/api/tasks' }, response: { status: 500 } });
        reportWorkspaceRequestError({ config: { url: '/shift/api/tasks' }, response: { status: 500, headers: { 'x-shift-error-reported': 'true' } } });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('deduplicates the same exception across capture paths and scrubs sensitive strings', () => {
        const error = new Error('Fixture token=private user@example.com https://consumer.test/page?password=hidden');
        reportWorkspaceError(error, { operation: 'render' });
        reportWorkspaceError(error, { operation: 'promise' });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(lastPayload().error.message).not.toMatch(/private|user@example.com|hidden/);
    });

    it('honors disabled reporting and rejects external reporting endpoints', () => {
        window.shiftConfig.errorReportingEnabled = false;
        reportWorkspaceError(new Error('Disabled fixture'), { operation: 'render' });
        window.shiftConfig.errorReportingEnabled = true;
        window.shiftConfig.errorReportingEndpoint = 'https://elsewhere.test/errors';
        reportWorkspaceError(new Error('External fixture'), { operation: 'render' });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not throw or recursively report when the reporting transport fails', async () => {
        fetchMock.mockRejectedValueOnce(new Error('Reporting unavailable'));
        expect(() => reportWorkspaceError(new Error('Transport fixture'), { operation: 'render' })).not.toThrow();
        await Promise.resolve();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('caps a stream of distinct failures for a single workspace page', () => {
        for (let number = 0; number < 25; number++) {
            reportWorkspaceError(new Error(`Flood fixture ${number}`), { operation: 'runtime' });
        }
        expect(fetchMock).toHaveBeenCalledTimes(20);
    });

    it('does not recapture an expected or server-reported request as an unhandled rejection', () => {
        const error = Object.assign(new Error('Already reported fixture'), {
            config: { url: '/shift/api/tasks' },
            response: { status: 500, headers: { 'x-shift-error-reported': 'true' } },
        });
        error.stack = 'Error: Already reported fixture\n at https://consumer.test/shift-assets/assets/workspace.js:4:8';
        reportWorkspaceRequestError(error);
        const event = new Event('unhandledrejection');
        Object.defineProperty(event, 'reason', { value: error });
        window.dispatchEvent(event);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('drops invalid correlation values from headers and payload context', () => {
        reportWorkspaceError(new Error('Invalid correlation fixture'), { operation: 'runtime', correlation_id: 'private-token' });
        expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('X-Shift-Correlation-ID');
        expect(lastPayload().context).not.toHaveProperty('correlation_id');
        expect(fetchMock.mock.calls[0][1].body).not.toContain('private-token');
    });

    it('uses the diagnostic CSRF token independently of logout route configuration', () => {
        window.shiftConfig.errorReportingCsrfToken = 'diagnostic-csrf';
        window.shiftConfig.csrfToken = null;
        reportWorkspaceError(new Error('CSRF fixture'), { operation: 'runtime' });
        expect(fetchMock.mock.calls[0][1].headers['X-CSRF-TOKEN']).toBe('diagnostic-csrf');
    });

    it('normalizes numeric and UUID request path IDs for stable operation grouping', () => {
        reportWorkspaceRequestError(Object.assign(new Error('Dynamic route fixture'), {
            config: { method: 'patch', url: '/shift/api/tasks/123/threads/10000000-0000-4000-8000-000000000001' },
            response: { status: 503 },
        }));
        expect(lastPayload().context.operation).toBe('PATCH /shift/api/tasks/:id/threads/:id');
    });
});
