import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import {
    defaultStatuses,
    defaultTasks,
    deleteMock,
    getMock,
    makeIndexResponse,
    mountWithTasks,
    resetTaskListTestState,
    seedTasks,
    stubs,
} from './test-helpers';
import TaskList from '../../components/TaskList.vue';

describe('TaskList listing and filters', () => {
    beforeEach(resetTaskListTestState);

    it('defaults to excluding completed and closed statuses', async () => {
        const wrapper = await mountWithTasks();

        expect(getMock).toHaveBeenCalledWith('/shift/api/tasks', {
            params: { page: 1, status: defaultStatuses, sort_by: 'updated_at' },
        });

        const rows = wrapper.findAll('[data-testid="task-row"]');
        expect(rows.length).toBe(4);
        const text = rows.map((row) => row.text()).join(' ');
        expect(text).not.toContain('completed');
        expect(text).not.toContain('closed');
        expect(text).toContain('Deployment paused');

        wrapper.unmount();
    });

    it('uses distinct status badge colors for each status', async () => {
        getMock.mockResolvedValueOnce(makeIndexResponse(seedTasks));

        const wrapper = mount(TaskList, {
            global: { stubs },
        });
        await flushPromises();
        await nextTick();

        expect(wrapper.get('[data-testid="task-status-badge-1"]').classes()).toContain('bg-amber-100');
        expect(wrapper.get('[data-testid="task-status-badge-2"]').classes()).toContain('bg-sky-100');
        expect(wrapper.get('[data-testid="task-status-badge-3"]').classes()).toContain('bg-indigo-100');
        expect(wrapper.get('[data-testid="task-status-badge-4"]').classes()).toContain('bg-emerald-100');
        expect(wrapper.get('[data-testid="task-status-badge-5"]').classes()).toContain('bg-slate-100');
        expect(wrapper.get('[data-testid="task-status-badge-6"]').classes()).toContain('bg-orange-100');

        wrapper.unmount();
    });

    it('uses distinct priority badge colors for each priority', async () => {
        getMock.mockResolvedValueOnce(makeIndexResponse(seedTasks));

        const wrapper = mount(TaskList, {
            global: { stubs },
        });
        await flushPromises();
        await nextTick();

        expect(wrapper.get('[data-testid="task-priority-badge-1"]').classes()).toContain('bg-rose-100');
        expect(wrapper.get('[data-testid="task-priority-badge-2"]').classes()).toContain('bg-fuchsia-100');
        expect(wrapper.get('[data-testid="task-priority-badge-3"]').classes()).toContain('bg-cyan-100');

        wrapper.unmount();
    });

    it('shows environment badges in list rows', async () => {
        getMock.mockResolvedValueOnce(makeIndexResponse(seedTasks));

        const wrapper = mount(TaskList, {
            global: { stubs },
        });
        await flushPromises();
        await nextTick();

        expect(wrapper.get('[data-testid="task-environment-badge-1"]').text()).toContain('Staging');
        expect(wrapper.get('[data-testid="task-environment-badge-3"]').text()).toContain('Unknown');

        wrapper.unmount();
    });

    it('syncs task id in URL when opening and closing the edit sheet', async () => {
        const pushStateSpy = vi.spyOn(window.history, 'pushState');

        getMock
            .mockResolvedValueOnce(makeIndexResponse(defaultTasks))
            .mockResolvedValueOnce({
                data: {
                    id: 1,
                    title: 'Auth issue',
                    priority: 'high',
                    status: 'pending',
                    created_at: '2026-02-10T17:40:00Z',
                    description: '',
                    submitter: { email: 'someone@example.com' },
                    attachments: [],
                },
            })
            .mockResolvedValueOnce({ data: { external: [] } });

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        const firstRow = wrapper.findAll('[data-testid="task-row"]')[0];
        await firstRow.find('button[title="Open details"]').trigger('click');
        await flushPromises();
        await nextTick();

        expect(window.location.search).toContain('task=1');
        expect(pushStateSpy.mock.calls.some(([, , next]) => next === '/shift/tasks?task=1')).toBe(true);

        (wrapper.vm as any).closeEditNow();
        await nextTick();

        expect(window.location.search).toBe('');
        expect(pushStateSpy.mock.calls.some(([, , next]) => next === '/shift/tasks')).toBe(true);
        wrapper.unmount();
        pushStateSpy.mockRestore();
    });

    it('opens task details from the task title', async () => {
        const pushStateSpy = vi.spyOn(window.history, 'pushState');

        getMock
            .mockResolvedValueOnce(makeIndexResponse(defaultTasks))
            .mockResolvedValueOnce({
                data: {
                    id: 1,
                    title: 'Auth issue',
                    priority: 'high',
                    status: 'pending',
                    created_at: '2026-02-10T17:40:00Z',
                    description: '',
                    submitter: { email: 'someone@example.com' },
                    attachments: [],
                },
            })
            .mockResolvedValueOnce({ data: { external: [] } });

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        await wrapper.get('[data-testid="task-title-1"]').trigger('click');
        await flushPromises();
        await nextTick();

        expect(getMock).toHaveBeenCalledWith('/shift/api/tasks/1');
        expect(window.location.search).toContain('task=1');
        expect(pushStateSpy.mock.calls.some(([, , next]) => next === '/shift/tasks?task=1')).toBe(true);

        wrapper.unmount();
        pushStateSpy.mockRestore();
    });

    it('confirms task deletion in an alert dialog before deleting', async () => {
        const confirmSpy = vi.fn(() => true);
        vi.stubGlobal('confirm', confirmSpy);
        deleteMock.mockResolvedValueOnce({ data: {} });

        const wrapper = await mountWithTasks();

        await wrapper.get('[data-testid="task-delete-1"]').trigger('click');
        await flushPromises();
        await nextTick();

        expect(confirmSpy).not.toHaveBeenCalled();
        expect(deleteMock).not.toHaveBeenCalled();
        expect(wrapper.text()).toContain('Delete task');
        expect(wrapper.text()).toContain('Delete Auth issue from SHIFT? This cannot be undone.');

        await wrapper.get('[data-testid="confirm-task-delete"]').trigger('click');
        await flushPromises();
        await nextTick();

        expect(deleteMock).toHaveBeenCalledWith('/shift/api/tasks/1');
        expect(wrapper.text()).not.toContain('Auth issue');

        vi.unstubAllGlobals();
        wrapper.unmount();
    });

    it('hides task deletion when SHIFT denies that capability', async () => {
        getMock.mockResolvedValueOnce(makeIndexResponse([
            {
                ...defaultTasks[0],
                can_delete: false,
            },
        ]));

        const wrapper = mount(TaskList, {
            global: { stubs },
        });
        await flushPromises();
        await nextTick();

        expect(wrapper.find('[data-testid="task-delete-1"]').exists()).toBe(false);
        wrapper.unmount();
    });

    it('auto-opens the edit sheet from task URL query', async () => {
        window.history.replaceState({}, '', '/shift/tasks?task=1');

        getMock
            .mockResolvedValueOnce(makeIndexResponse(defaultTasks))
            .mockResolvedValueOnce({
                data: {
                    id: 1,
                    title: 'Auth issue',
                    priority: 'high',
                    status: 'pending',
                    created_at: '2026-02-10T17:40:00Z',
                    description: '',
                    submitter: { email: 'someone@example.com' },
                    attachments: [],
                },
            })
            .mockResolvedValueOnce({ data: { external: [] } });

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        expect(getMock).toHaveBeenCalledWith('/shift/api/tasks/1');
        expect(getMock).toHaveBeenCalledWith('/shift/api/tasks/1/threads');
        wrapper.unmount();
    });

    it('handles browser popstate navigation for task deep links', async () => {
        getMock
            .mockResolvedValueOnce(makeIndexResponse(defaultTasks))
            .mockResolvedValueOnce({
                data: {
                    id: 1,
                    title: 'Auth issue',
                    priority: 'high',
                    status: 'pending',
                    created_at: '2026-02-10T17:40:00Z',
                    description: '',
                    submitter: { email: 'someone@example.com' },
                    attachments: [],
                },
            })
            .mockResolvedValueOnce({ data: { external: [] } });

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        window.history.replaceState({}, '', '/shift/tasks?task=1');
        window.dispatchEvent(new PopStateEvent('popstate'));
        await flushPromises();
        await nextTick();

        expect(getMock).toHaveBeenCalledWith('/shift/api/tasks/1');

        window.history.replaceState({}, '', '/shift/tasks');
        window.dispatchEvent(new PopStateEvent('popstate'));
        await flushPromises();
        await nextTick();

        expect(window.location.search).toBe('');
        expect((wrapper.vm as any).editOpen).toBe(false);
        wrapper.unmount();
    });

    it('filters by priority', async () => {
        getMock.mockResolvedValueOnce(makeIndexResponse(defaultTasks)).mockResolvedValueOnce(makeIndexResponse([seedTasks[0]]));

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        await wrapper.get('[data-testid="priority-low"]').setValue(false);
        await wrapper.get('[data-testid="priority-medium"]').setValue(false);
        await nextTick();

        // Draft changes should not apply until the user clicks Apply.
        expect(wrapper.findAll('[data-testid="task-row"]').length).toBe(4);

        await wrapper.get('[data-testid="filters-apply"]').trigger('click');
        await flushPromises();
        await nextTick();

        expect(getMock).toHaveBeenLastCalledWith('/shift/api/tasks', {
            params: { page: 1, status: defaultStatuses, priority: ['high'], sort_by: 'updated_at' },
        });

        const rows = wrapper.findAll('[data-testid="task-row"]');
        expect(rows.length).toBe(1);
        expect(rows[0].text()).toContain('Auth issue');

        wrapper.unmount();
    });

    it('filters by search term', async () => {
        getMock.mockResolvedValueOnce(makeIndexResponse(defaultTasks)).mockResolvedValueOnce(makeIndexResponse([seedTasks[0]]));

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        await wrapper.get('[data-testid="filter-search"]').setValue('auth');
        await nextTick();

        await wrapper.get('[data-testid="filters-apply"]').trigger('click');
        await flushPromises();
        await nextTick();

        expect(getMock).toHaveBeenLastCalledWith('/shift/api/tasks', {
            params: { page: 1, status: defaultStatuses, search: 'auth', sort_by: 'updated_at' },
        });

        const rows = wrapper.findAll('[data-testid="task-row"]');
        expect(rows.length).toBe(1);
        expect(rows[0].text()).toContain('Auth issue');

        wrapper.unmount();
    });

    it('filters by environment', async () => {
        getMock.mockResolvedValueOnce(makeIndexResponse(defaultTasks)).mockResolvedValueOnce(makeIndexResponse([seedTasks[0]]));

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        await wrapper.get('[data-testid="filter-environment"]').setValue('staging');
        await nextTick();

        await wrapper.get('[data-testid="filters-apply"]').trigger('click');
        await flushPromises();
        await nextTick();

        expect(getMock).toHaveBeenLastCalledWith('/shift/api/tasks', {
            params: { page: 1, status: defaultStatuses, environment: 'staging', sort_by: 'updated_at' },
        });
        expect(wrapper.findAll('[data-testid="task-row"]')).toHaveLength(1);

        wrapper.unmount();
    });

    it('filters by sort option', async () => {
        getMock.mockResolvedValueOnce(makeIndexResponse(defaultTasks)).mockResolvedValueOnce(makeIndexResponse(defaultTasks));

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        await wrapper.get('[data-testid="sort-by-priority"]').trigger('click');
        await nextTick();
        await wrapper.get('[data-testid="filters-apply"]').trigger('click');
        await flushPromises();
        await nextTick();

        expect(getMock).toHaveBeenLastCalledWith('/shift/api/tasks', {
            params: { page: 1, status: defaultStatuses, sort_by: 'priority' },
        });

        wrapper.unmount();
    });

});
