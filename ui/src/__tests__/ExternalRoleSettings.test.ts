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
        vi.useRealTimers();
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

        expect(getMock).toHaveBeenCalledWith('/shift/api/external-roles', {
            params: { paginate: 1, page: 1, per_page: 10 },
        });
        expect(wrapper.text()).toContain('External Roles');
        expect(wrapper.text()).toContain('Client Owner');
        expect(wrapper.text()).toContain('owner@example.com');
        expect(wrapper.text()).toContain('Owner');
        expect(wrapper.get('[data-testid="external-role-manager"]').find('table[data-slot="table"]').exists()).toBe(true);
        expect(wrapper.get('[data-testid="external-role-row-client-1"]').element.tagName).toBe('TR');
    });

    it('accepts labeled role options from SHIFT', async () => {
        getMock.mockResolvedValueOnce({
            data: {
                capabilities: {
                    can_manage_external_roles: true,
                },
                roles: [
                    { value: 'owner', label: 'Owner', group: 'App roles' },
                    { value: 'client_developer', label: 'Developer', group: 'App roles' },
                    { value: 'shift_developer', label: 'SHIFT Developer', group: 'SHIFT roles' },
                ],
                users: [
                    {
                        id: 'client-1',
                        name: 'Project Developer',
                        email: 'developer@example.com',
                        role: 'client_developer',
                    },
                ],
            },
        });

        const wrapper = mount(ExternalRoleSettings);
        await flushPromises();

        const options = wrapper.get('[data-testid="external-role-row-client-1"]').findAll('option');
        expect(options.map((option) => option.attributes('value'))).toEqual(['owner', 'client_developer', 'shift_developer']);
        expect(options.map((option) => option.text())).toEqual(['Owner', 'Developer', 'SHIFT Developer']);
        expect(
            wrapper
                .get('[data-testid="external-role-row-client-1"]')
                .findAll('optgroup')
                .map((group) => group.attributes('label')),
        ).toEqual(['App roles', 'SHIFT roles']);
        expect(
            wrapper
                .get('[data-testid="external-role-mobile-row-client-1"]')
                .findAll('optgroup')
                .map((group) => group.attributes('label')),
        ).toEqual(['App roles', 'SHIFT roles']);
        expect(wrapper.get('[data-testid="external-role-current-client-1"]').text()).toBe('Developer');
        expect(wrapper.get('[data-testid="external-role-mobile-current-client-1"]').text()).toBe('Developer');
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

    it('paginates legacy responses client-side and requests the selected page', async () => {
        const users = Array.from({ length: 12 }, (_, index) => ({
            id: `client-${index + 1}`,
            name: `Client ${index + 1}`,
            email: `client-${index + 1}@example.com`,
            role: 'user',
        }));
        const response = {
            data: {
                capabilities: { can_manage_external_roles: true },
                roles: ['owner', 'client_developer', 'user', 'guest', 'shift_lead_developer', 'shift_developer'],
                users,
            },
        };
        getMock.mockResolvedValue(response);

        const wrapper = mount(ExternalRoleSettings);
        await flushPromises();

        expect(wrapper.findAll('[data-testid^="external-role-row-"]')).toHaveLength(10);
        expect(wrapper.text()).toContain('Showing 1 to 10 of 12 users');

        await wrapper.get('[data-testid="external-role-page-2"]').trigger('click');
        await flushPromises();

        expect(getMock).toHaveBeenLastCalledWith('/shift/api/external-roles', {
            params: { paginate: 1, page: 2, per_page: 10 },
        });
        expect(wrapper.findAll('[data-testid^="external-role-row-"]')).toHaveLength(2);
        expect(wrapper.text()).toContain('Client 11');
        expect(wrapper.text()).toContain('Showing 11 to 12 of 12 users');
    });

    it('resets to page one when backend search changes', async () => {
        vi.useFakeTimers();
        getMock
            .mockResolvedValueOnce({
                data: {
                    capabilities: { can_manage_external_roles: true },
                    users: [{ id: 'client-1', name: 'Client 1', email: 'client-1@example.com', role: 'user' }],
                    pagination: { current_page: 1, last_page: 2, per_page: 10, total: 11, from: 1, to: 10 },
                },
            })
            .mockResolvedValueOnce({
                data: {
                    capabilities: { can_manage_external_roles: true },
                    users: [{ id: 'client-11', name: 'Client 11', email: 'client-11@example.com', role: 'user' }],
                    pagination: { current_page: 2, last_page: 2, per_page: 10, total: 11, from: 11, to: 11 },
                },
            })
            .mockResolvedValueOnce({
                data: {
                    capabilities: { can_manage_external_roles: true },
                    users: [{ id: 'client-11', name: 'Client 11', email: 'client-11@example.com', role: 'user' }],
                    pagination: { current_page: 1, last_page: 1, per_page: 10, total: 1, from: 1, to: 1 },
                },
            });

        const wrapper = mount(ExternalRoleSettings);
        await flushPromises();
        await wrapper.get('[data-testid="external-role-page-2"]').trigger('click');
        await flushPromises();

        await wrapper.get('[data-testid="external-role-search"]').setValue('eleven@example.com');
        vi.advanceTimersByTime(300);
        await flushPromises();

        expect(getMock).toHaveBeenLastCalledWith('/shift/api/external-roles', {
            params: { paginate: 1, page: 1, per_page: 10, search: 'eleven@example.com' },
        });
        expect(wrapper.get('[data-testid="external-role-page-input"]').element).toHaveProperty('value', '1');

        wrapper.unmount();
        vi.useRealTimers();
    });

    it('renders loading, error, and filtered empty states', async () => {
        let resolveRequest: ((value: unknown) => void) | undefined;
        getMock.mockReturnValueOnce(new Promise((resolve) => (resolveRequest = resolve)));

        const loadingWrapper = mount(ExternalRoleSettings);
        expect(loadingWrapper.find('[data-testid="external-role-loading"]').exists()).toBe(true);
        resolveRequest?.({ data: { capabilities: { can_manage_external_roles: true }, users: [] } });
        await flushPromises();
        loadingWrapper.unmount();

        getMock.mockRejectedValueOnce({ response: { data: { message: 'Portal unavailable' } } });
        const errorWrapper = mount(ExternalRoleSettings);
        await flushPromises();
        expect(errorWrapper.get('[data-testid="external-role-error"]').text()).toContain('Portal unavailable');
        errorWrapper.unmount();

        vi.useFakeTimers();
        getMock
            .mockResolvedValueOnce({ data: { capabilities: { can_manage_external_roles: true }, users: [] } })
            .mockResolvedValueOnce({ data: { capabilities: { can_manage_external_roles: true }, users: [] } });
        const emptyWrapper = mount(ExternalRoleSettings);
        await flushPromises();
        await emptyWrapper.get('[data-testid="external-role-search"]').setValue('missing@example.com');
        vi.advanceTimersByTime(300);
        await flushPromises();
        expect(emptyWrapper.get('[data-testid="external-role-empty"]').text()).toContain('No users match this search.');
        emptyWrapper.unmount();
        vi.useRealTimers();
    });
});
