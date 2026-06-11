import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExternalRoleSettings from '../components/ExternalRoleSettings.vue';

const getMock = vi.fn();
const putMock = vi.fn();

vi.mock('@/axios-config', () => ({
    default: {
        get: (...args: any[]) => getMock(...args),
        put: (...args: any[]) => putMock(...args),
    },
}));

describe('ExternalRoleSettings.vue', () => {
    beforeEach(() => {
        getMock.mockReset();
        putMock.mockReset();
    });

    it('renders external role management when SHIFT grants the capability', async () => {
        getMock.mockResolvedValueOnce({
            data: {
                capabilities: {
                    can_manage_external_roles: true,
                },
                roles: ['owner', 'client_developer', 'user'],
                users: [
                    {
                        id: 'client-1',
                        name: 'Client Owner',
                        email: 'owner@example.com',
                        role: 'owner',
                    },
                ],
            },
        });

        const wrapper = mount(ExternalRoleSettings);
        await flushPromises();

        expect(getMock).toHaveBeenCalledWith('/shift/api/external-roles');
        expect(wrapper.text()).toContain('External Roles');
        expect(wrapper.text()).toContain('Client Owner');
        expect(wrapper.text()).toContain('owner@example.com');
        expect(wrapper.text()).toContain('Owner');
    });

    it('accepts labeled role options from SHIFT', async () => {
        getMock.mockResolvedValueOnce({
            data: {
                capabilities: {
                    can_manage_external_roles: true,
                },
                roles: [
                    { value: 'owner', label: 'Owner' },
                    { value: 'shift_developer', label: 'SHIFT Developer' },
                ],
                users: [
                    {
                        id: 'client-1',
                        name: 'Client Owner',
                        email: 'owner@example.com',
                        role: 'shift_developer',
                    },
                ],
            },
        });

        const wrapper = mount(ExternalRoleSettings);
        await flushPromises();

        const options = wrapper.findAll('option');
        expect(options.map((option) => option.attributes('value'))).toEqual(['owner', 'shift_developer']);
        expect(wrapper.text()).toContain('SHIFT Developer');
    });

    it('does not render role controls when SHIFT denies the capability', async () => {
        getMock.mockResolvedValueOnce({
            data: {
                capabilities: {
                    can_manage_external_roles: false,
                },
                roles: ['owner'],
                users: [
                    {
                        id: 'client-1',
                        name: 'Client Owner',
                        email: 'owner@example.com',
                        role: 'owner',
                    },
                ],
            },
        });

        const wrapper = mount(ExternalRoleSettings);
        await flushPromises();

        expect(wrapper.text()).toContain('Settings unavailable');
        expect(wrapper.text()).not.toContain('Client Owner');
        expect(wrapper.find('[data-testid="external-role-manager"]').exists()).toBe(false);
    });
});
