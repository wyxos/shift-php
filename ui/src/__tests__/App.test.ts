import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App.vue';

vi.mock('vue-sonner', () => ({
    Toaster: {
        props: {
            richColors: Boolean,
            position: String,
        },
        template: '<div data-testid="toaster" :data-rich-colors="String(richColors)" :data-position="position" />',
    },
}));

describe('App.vue', () => {
    beforeEach(() => {
        vi.stubGlobal('shiftConfig', {
            loginRoute: '/shift/login',
        });
    });

    it('mounts bottom-center toast notifications', () => {
        const wrapper = mount(App, {
            global: {
                stubs: {
                    AppContent: { template: '<main><slot /></main>' },
                    AppSidebarHeader: { template: '<header />' },
                    AuthErrorModal: { template: '<div />' },
                    RouterView: { template: '<section />' },
                    ShiftShell: { template: '<div><slot /></div>' },
                    ShiftSidebar: { template: '<aside />' },
                },
            },
        });

        expect(wrapper.get('[data-testid="toaster"]').attributes()).toMatchObject({
            'data-rich-colors': 'true',
            'data-position': 'bottom-center',
        });
    });
});
