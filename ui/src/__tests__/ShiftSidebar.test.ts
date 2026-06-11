import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { h } from 'vue';
import ShiftSidebar from '../components/ShiftSidebar.vue';

const getMock = vi.fn();

function passthroughComponent(name: string): any {
    return {
        name,
        props: ['asChild', 'isActive', 'tooltip', 'size', 'variant', 'collapsible'],
        render(this: any) {
            return h('div', {}, this.$slots.default?.());
        },
    };
}

vi.mock('@/axios-config', () => ({
    default: {
        get: (...args: any[]) => getMock(...args),
    },
}));

vi.mock('vue-router', () => ({
    useRoute: () => ({
        path: '/dashboard',
    }),
}));

vi.mock('@shift/components/AppLogo.vue', () => ({
    default: passthroughComponent('AppLogo'),
}));

vi.mock('@shift/ui/sidebar', () => ({
    Sidebar: passthroughComponent('Sidebar'),
    SidebarContent: passthroughComponent('SidebarContent'),
    SidebarFooter: passthroughComponent('SidebarFooter'),
    SidebarGroup: passthroughComponent('SidebarGroup'),
    SidebarGroupLabel: passthroughComponent('SidebarGroupLabel'),
    SidebarHeader: passthroughComponent('SidebarHeader'),
    SidebarMenu: passthroughComponent('SidebarMenu'),
    SidebarMenuButton: passthroughComponent('SidebarMenuButton'),
    SidebarMenuItem: passthroughComponent('SidebarMenuItem'),
}));

describe('ShiftSidebar.vue', () => {
    beforeEach(() => {
        getMock.mockReset();

        window.shiftConfig = {
            baseUrl: 'https://consumer.test',
            loginRoute: '/login',
            logoutRoute: '/logout',
            appName: 'Consumer',
            username: 'Manager',
            email: 'manager@example.com',
            aiEnabled: false,
        };
    });

    it('shows Settings only when SHIFT capabilities allow external role management', async () => {
        getMock.mockResolvedValueOnce({
            data: {
                capabilities: {
                    can_manage_external_roles: true,
                },
            },
        });

        const wrapper = mountSidebar();
        await flushPromises();

        expect(getMock).toHaveBeenCalledWith('/shift/api/external-roles/capabilities');
        expect(wrapper.text()).toContain('Settings');
        expect(wrapper.find('a[href="/settings"]').exists()).toBe(true);
    });

    it('keeps Settings hidden when SHIFT capabilities deny external role management', async () => {
        getMock.mockResolvedValueOnce({
            data: {
                capabilities: {
                    can_manage_external_roles: false,
                },
            },
        });

        const wrapper = mountSidebar();
        await flushPromises();

        expect(wrapper.text()).not.toContain('Settings');
        expect(wrapper.find('a[href="/settings"]').exists()).toBe(false);
    });
});

function mountSidebar() {
    return mount(ShiftSidebar, {
        global: {
            stubs: {
                'router-link': {
                    props: ['to'],
                    template: '<a :href="to"><slot /></a>',
                },
            },
        },
    });
}
