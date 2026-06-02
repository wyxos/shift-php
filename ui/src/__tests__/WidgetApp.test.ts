import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WidgetApp from '../widget/WidgetApp.vue';

describe('WidgetApp.vue', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('uses the refreshed csrf token after inline login before submitting the preserved draft', async () => {
        const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
            const requestUrl = String(url);

            if (requestUrl === '/shift/api/widget/config') {
                return jsonResponse({
                    widget_enabled: true,
                    guest_submissions_enabled: true,
                    login_credential_field: 'email',
                });
            }

            if (requestUrl === '/shift/api/widget/session-user') {
                return jsonResponse({
                    authenticated: false,
                    user: null,
                });
            }

            if (requestUrl === '/shift/api/widget/login') {
                expect(headerValue(init, 'X-CSRF-TOKEN')).toBe('before-login');

                return jsonResponse({
                    authenticated: true,
                    csrf_token: 'after-login',
                    user: {
                        id: 7,
                        name: 'Widget User',
                        email: 'widget-user@example.com',
                    },
                });
            }

            if (requestUrl === '/shift/api/widget/tasks') {
                expect(headerValue(init, 'X-CSRF-TOKEN')).toBe('after-login');

                return jsonResponse({
                    id: 42,
                    title: JSON.parse(String(init?.body)).title,
                });
            }

            throw new Error(`Unexpected request: ${requestUrl}`);
        });

        vi.stubGlobal('fetch', fetchMock);

        const wrapper = mount(WidgetApp, {
            props: {
                config: {
                    appName: 'Consumer App',
                    authenticated: false,
                    csrfToken: 'before-login',
                    guestSubmissionsEnabled: true,
                    loginCredentialField: 'email',
                    endpoints: {
                        config: '/shift/api/widget/config',
                        tasks: '/shift/api/widget/tasks',
                        sessionUser: '/shift/api/widget/session-user',
                        login: '/shift/api/widget/login',
                    },
                },
            },
        });

        await flushPromises();

        await wrapper.get('button.shift-widget__launcher').trigger('click');
        await wrapper.find('input[type="text"]').setValue('Draft survives login');
        await wrapper.find('textarea').setValue('The user should submit this exact draft after login.');
        await clickButton(wrapper, 'Log in');
        await wrapper.findAll('input[type="text"]')[1].setValue('widget-user@example.com');
        await wrapper.find('input[type="password"]').setValue('correct-password');
        await clickLastButton(wrapper, 'Log in');
        await flushPromises();

        expect(wrapper.text()).toContain('Widget User');
        expect(wrapper.find<HTMLInputElement>('input[type="text"]').element.value).toBe('Draft survives login');
        expect(wrapper.find<HTMLTextAreaElement>('textarea').element.value).toBe(
            'The user should submit this exact draft after login.',
        );

        await wrapper.get('form').trigger('submit');
        await flushPromises();

        expect(wrapper.text()).toContain('Report sent');
        expect(fetchMock).toHaveBeenCalledWith(
            '/shift/api/widget/tasks',
            expect.objectContaining({
                method: 'POST',
            }),
        );
    });
});

function jsonResponse(body: unknown): Response {
    return {
        ok: true,
        status: 200,
        json: async () => body,
    } as Response;
}

function headerValue(init: RequestInit | undefined, name: string): string | undefined {
    const headers = init?.headers as Record<string, string> | undefined;

    return headers?.[name];
}

async function clickButton(wrapper: ReturnType<typeof mount>, text: string): Promise<void> {
    const button = wrapper.findAll('button').find((candidate) => candidate.text() === text);

    if (! button) {
        throw new Error(`Button not found: ${text}`);
    }

    await button.trigger('click');
}

async function clickLastButton(wrapper: ReturnType<typeof mount>, text: string): Promise<void> {
    const button = wrapper
        .findAll('button')
        .slice()
        .reverse()
        .find((candidate) => candidate.text() === text);

    if (! button) {
        throw new Error(`Button not found: ${text}`);
    }

    await button.trigger('click');
}
