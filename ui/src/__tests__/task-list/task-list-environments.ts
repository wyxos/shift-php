import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import TaskList from '../../components/TaskList.vue';
import { defaultStatuses, defaultTasks, getMock, makeIndexResponse, resetTaskListTestState, seedTasks, stubs } from './test-helpers';

const environments = [
    { key: 'production', label: 'Production' },
    { key: 'staging', label: 'Staging' },
];

describe('TaskList registered environment filters', () => {
    beforeEach(resetTaskListTestState);

    it('uses responsive single-select buttons and resets with All', async () => {
        getMock
            .mockResolvedValueOnce(makeIndexResponse(defaultTasks, environments))
            .mockResolvedValueOnce(makeIndexResponse([seedTasks[0]], environments))
            .mockResolvedValueOnce(makeIndexResponse(defaultTasks, environments));

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        expect(wrapper.find('input[data-testid="filter-environment"]').exists()).toBe(false);
        expect(wrapper.get('[data-testid="filter-environment-all"]').attributes('role')).toBe('radio');
        expect(wrapper.get('[data-testid="filter-environment-production"]').attributes('role')).toBe('radio');
        expect(wrapper.get('[data-testid="filter-environment-staging"]').attributes('role')).toBe('radio');

        await wrapper.get('[data-testid="filter-environment-staging"]').trigger('click');
        await wrapper.get('[data-testid="filters-apply"]').trigger('click');
        await flushPromises();

        expect(getMock).toHaveBeenLastCalledWith('/shift/api/tasks', {
            params: { page: 1, status: defaultStatuses, environment: 'staging', sort_by: 'updated_at' },
        });

        await wrapper.get('[data-testid="filter-environment-all"]').trigger('click');
        await wrapper.get('[data-testid="filters-apply"]').trigger('click');
        await flushPromises();

        expect(getMock).toHaveBeenLastCalledWith('/shift/api/tasks', {
            params: { page: 1, status: defaultStatuses, sort_by: 'updated_at' },
        });

        wrapper.unmount();
    });

    it('supports arrow-key selection', async () => {
        getMock
            .mockResolvedValueOnce(makeIndexResponse(defaultTasks, environments))
            .mockResolvedValueOnce(makeIndexResponse(defaultTasks, environments));

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        await wrapper.get('[data-testid="filter-environment-all"]').trigger('keydown', { key: 'ArrowRight' });
        await wrapper.get('[data-testid="filters-apply"]').trigger('click');
        await flushPromises();

        expect(wrapper.get('[data-testid="filter-environment-production"]').attributes('aria-checked')).toBe('true');
        expect(getMock).toHaveBeenLastCalledWith('/shift/api/tasks', {
            params: { page: 1, status: defaultStatuses, environment: 'production', sort_by: 'updated_at' },
        });

        wrapper.unmount();
    });

    it('uses the same buttons for requirements', async () => {
        window.history.replaceState({}, '', '/shift/requirements');
        getMock
            .mockResolvedValueOnce(makeIndexResponse([], [{ key: 'staging', label: 'Staging' }]))
            .mockResolvedValueOnce(makeIndexResponse([], [{ key: 'staging', label: 'Staging' }]));

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        await wrapper.get('[data-testid="filter-environment-staging"]').trigger('click');
        await wrapper.get('[data-testid="filters-apply"]').trigger('click');
        await flushPromises();

        expect(getMock).toHaveBeenLastCalledWith('/shift/api/requirements', {
            params: { page: 1, environment: 'staging', sort_by: 'updated_at' },
        });

        wrapper.unmount();
    });
});
