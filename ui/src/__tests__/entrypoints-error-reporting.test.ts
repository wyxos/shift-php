import { afterEach, describe, expect, it, vi } from 'vitest';

describe('package UI entrypoints', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.doUnmock('../App.vue');
        vi.doUnmock('../router');
        vi.doUnmock('../widget/WidgetApp.vue');
        vi.doUnmock('@shift/composables/useAppearance');
        vi.restoreAllMocks();
        vi.resetModules();
        vi.unstubAllGlobals();
    });

    it('does not install global browser error reporting from the dashboard entrypoint', async () => {
        document.body.innerHTML = '<div id="app"></div>';
        vi.doMock('@shift/composables/useAppearance', () => ({
            initializeTheme: vi.fn(),
        }));
        vi.doMock('../App.vue', () => ({
            default: {
                template: '<div />',
            },
        }));
        vi.doMock('../router', () => ({
            default: {
                install: vi.fn(),
            },
        }));
        const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

        await import('../main');

        expect(errorReportingListenerRegistrations(addEventListenerSpy)).toHaveLength(0);
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

        expect(errorReportingListenerRegistrations(addEventListenerSpy)).toHaveLength(0);
    });
});

function errorReportingListenerRegistrations(spy: ReturnType<typeof vi.spyOn>): unknown[] {
    return spy.mock.calls.filter(([event]) => event === 'error' || event === 'unhandledrejection');
}
