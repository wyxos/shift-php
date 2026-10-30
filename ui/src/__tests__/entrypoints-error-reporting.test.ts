import { afterEach, describe, expect, it, vi } from 'vitest';

describe('package UI entrypoints', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.doUnmock('../App.vue');
        vi.doUnmock('../router');
        vi.doUnmock('../widget/WidgetApp.vue');
        vi.doUnmock('@shift/composables/useAppearance');
        vi.doUnmock('../workspace');
        vi.restoreAllMocks();
        vi.resetModules();
        vi.unstubAllGlobals();
    });

    it('installs scoped browser capture before the workspace starts', async () => {
        document.body.innerHTML = '<div id="app"></div>';
        vi.doMock('@shift/composables/useAppearance', () => ({
            initializeTheme: vi.fn(),
        }));
        vi.doMock('../App.vue', () => ({
            default: {
                template: '<div />',
            },
        }));
        vi.doMock('../workspace', () => ({}));
        const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

        await import('../main');
        await vi.dynamicImportSettled();

        const listeners = errorReportingListenerRegistrations(addEventListenerSpy.mock.calls);
        expect(listeners).toHaveLength(2);
        for (const [event, listener, capture] of listeners as [string, EventListener, boolean][]) {
            window.removeEventListener(event, listener, capture);
        }
    });

    it('does not install global browser error reporting from the widget entrypoint', async () => {
        const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
        vi.doMock('../widget/WidgetApp.vue', () => ({
            default: {
                props: ['config'],
                template: '<div />',
            },
        }));

        Object.defineProperty(window, 'shiftWidgetConfig', {
            configurable: true,
            value: {
                appName: 'Consumer App',
                authenticated: false,
                csrfToken: 'csrf-token',
                guestSubmissionsEnabled: false,
                loginCredentialField: 'email',
                endpoints: {
                    config: '/shift/api/widget/config',
                    tasks: '/shift/api/widget/tasks',
                    sessionUser: '/shift/api/widget/session-user',
                    login: '/shift/api/widget/login',
                },
            },
        });

        await import('../widget');

        expect(errorReportingListenerRegistrations(addEventListenerSpy.mock.calls)).toHaveLength(0);
    });

    it('reports startup import failures after installing capture', async () => {
        const error = new Error('Fixture workspace import failed');
        vi.doMock('../workspace', () => { throw error; });
        const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
        vi.stubGlobal('fetch', fetchMock);
        window.shiftConfig = { errorReportingEnabled: true } as Window['shiftConfig'];
        const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

        await import('../main');
        await vi.dynamicImportSettled();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
            error: { name: 'Error', message: expect.stringContaining('error') }, context: { operation: 'startup' },
        });
        const listeners = errorReportingListenerRegistrations(addEventListenerSpy.mock.calls);
        for (const [event, listener, capture] of listeners as [string, EventListener, boolean][]) {
            window.removeEventListener(event, listener, capture);
        }
    });
});

function errorReportingListenerRegistrations(calls: readonly (readonly unknown[])[]): unknown[] {
    return calls.filter(([event]) => event === 'error' || event === 'unhandledrejection');
}
