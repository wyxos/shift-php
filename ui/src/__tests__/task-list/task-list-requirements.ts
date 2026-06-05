import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import {
    defaultStatuses,
    defaultTasks,
    getMock,
    makeIndexResponse,
    postMock,
    resetTaskListTestState,
    stubs,
} from './test-helpers';
import TaskList from '../../components/TaskList.vue';

const requirementItems = [
    {
        id: 20,
        title: 'Portal reporting',
        status: 'pending',
        priority: 'medium',
        phase: 'requirement',
        finalized: false,
        environment: 'staging',
    },
];
const mixedRequirementItems = [
    {
        id: 20,
        title: 'Portal reporting',
        status: 'pending',
        priority: 'medium',
        phase: 'requirement',
        finalized: false,
        environment: 'staging',
        batch: {
            id: 5,
            title: 'June scope',
            total_items: 2,
            requirement_items: 1,
            finalized_items: 1,
        },
    },
    {
        id: 21,
        title: 'CSV export',
        status: 'pending',
        priority: 'medium',
        phase: 'task',
        finalized: true,
        finalized_at: '2026-06-05T10:30:00Z',
        environment: 'staging',
        batch: {
            id: 5,
            title: 'June scope',
            total_items: 2,
            requirement_items: 1,
            finalized_items: 1,
        },
    },
];

describe('TaskList requirements flow', () => {
    beforeEach(resetTaskListTestState);

    it('lists requirements separately from active tasks', async () => {
        getMock.mockResolvedValueOnce(makeIndexResponse(defaultTasks)).mockResolvedValueOnce(makeIndexResponse(requirementItems));

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        expect(wrapper.text()).toContain('Auth issue');

        await wrapper.get('[data-testid="requirements-tab"]').trigger('click');
        await flushPromises();
        await nextTick();

        expect(getMock).toHaveBeenCalledWith('/shift/api/requirements', {
            params: { page: 1, status: defaultStatuses, sort_by: 'updated_at' },
        });
        expect(wrapper.text()).toContain('Portal reporting');
        expect(wrapper.text()).not.toContain('Auth issue');
        expect(wrapper.find('[data-testid="open-requirement-pack"]').exists()).toBe(true);

        wrapper.unmount();
    });

    it('shows requirement pack counts and finalized item state', async () => {
        getMock.mockResolvedValueOnce(makeIndexResponse(defaultTasks)).mockResolvedValueOnce(makeIndexResponse(mixedRequirementItems));

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        await wrapper.get('[data-testid="requirements-tab"]').trigger('click');
        await flushPromises();
        await nextTick();

        expect(wrapper.text()).toContain('June scope');
        expect(wrapper.text()).toContain('2 items · 1 pending · 1 finalized');
        expect(wrapper.text()).toContain('Portal reporting');
        expect(wrapper.text()).toContain('CSV export');
        expect(wrapper.get('[data-testid="requirement-finalized-badge-21"]').text()).toContain('Finalized');
        expect(wrapper.find('[data-testid="requirement-finalized-badge-20"]').exists()).toBe(false);

        wrapper.unmount();
    });

    it('uses the requirements route as the initial surface', async () => {
        window.history.replaceState({}, '', '/shift/requirements');
        getMock.mockResolvedValueOnce(makeIndexResponse(requirementItems));

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        expect(getMock).toHaveBeenCalledWith('/shift/api/requirements', {
            params: { page: 1, status: defaultStatuses, sort_by: 'updated_at' },
        });
        expect(wrapper.get('[data-testid="requirements-tab"]').attributes('aria-selected')).toBe('true');
        expect(wrapper.text()).toContain('Portal reporting');

        wrapper.unmount();
    });

    it('updates the route when switching between task and requirement tabs', async () => {
        getMock.mockResolvedValueOnce(makeIndexResponse(defaultTasks)).mockResolvedValueOnce(makeIndexResponse(requirementItems));

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        await wrapper.get('[data-testid="requirements-tab"]').trigger('click');
        await flushPromises();
        await nextTick();

        expect(window.location.pathname).toBe('/shift/requirements');
        expect(getMock).toHaveBeenLastCalledWith('/shift/api/requirements', {
            params: { page: 1, status: defaultStatuses, sort_by: 'updated_at' },
        });

        getMock.mockResolvedValueOnce(makeIndexResponse(defaultTasks));
        await wrapper.get('[data-testid="tasks-tab"]').trigger('click');
        await flushPromises();
        await nextTick();

        expect(window.location.pathname).toBe('/shift/tasks');
        expect(getMock).toHaveBeenLastCalledWith('/shift/api/tasks', {
            params: { page: 1, status: defaultStatuses, sort_by: 'updated_at' },
        });

        wrapper.unmount();
    });

    it('submits multiple requirement items in one batch', async () => {
        getMock
            .mockResolvedValueOnce(makeIndexResponse(defaultTasks))
            .mockResolvedValueOnce(makeIndexResponse([]))
            .mockResolvedValueOnce(makeIndexResponse(requirementItems));

        postMock.mockResolvedValueOnce({
            data: {
                batch: { id: 5, title: 'June scope' },
                items: requirementItems,
            },
        });

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        await wrapper.get('[data-testid="requirements-tab"]').trigger('click');
        await flushPromises();
        await nextTick();

        await wrapper.get('[data-testid="open-requirement-pack"]').trigger('click');
        await nextTick();

        await wrapper.get('[data-testid="requirement-pack-title"]').setValue('June scope');
        await wrapper.get('[data-testid="requirement-item-title-0"]').setValue('Portal reporting');
        await wrapper.get('[data-testid="requirement-item-description-0"]').setValue('Need a dashboard');
        await wrapper.get('[data-testid="add-requirement-item"]').trigger('click');
        await nextTick();
        await wrapper.get('[data-testid="requirement-item-title-1"]').setValue('Export flow');
        await wrapper.get('[data-testid="requirement-item-description-1"]').setValue('Need CSV export');
        await wrapper.get('[data-testid="requirement-pack-form"]').trigger('submit');
        await flushPromises();
        await nextTick();

        expect(postMock).toHaveBeenCalledWith('/shift/api/requirements/batches', {
            title: 'June scope',
            items: [
                { title: 'Portal reporting', description: 'Need a dashboard' },
                { title: 'Export flow', description: 'Need CSV export' },
            ],
        });
        expect(getMock).toHaveBeenLastCalledWith('/shift/api/requirements', {
            params: { page: 1, status: defaultStatuses, sort_by: 'updated_at' },
        });
        expect(wrapper.get('[data-testid="task-row"]').classes()).toContain('ring-2');

        wrapper.unmount();
    });

    it('opens requirement details and comments through task thread endpoints', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-10T18:00:00Z'));

        getMock
            .mockResolvedValueOnce(makeIndexResponse(defaultTasks))
            .mockResolvedValueOnce(makeIndexResponse(requirementItems))
            .mockResolvedValueOnce({
                data: {
                    id: 20,
                    title: 'Portal reporting',
                    priority: 'medium',
                    status: 'pending',
                    phase: 'requirement',
                    created_at: '2026-02-10T17:40:00Z',
                    description: 'Need a dashboard',
                    submitter: { email: 'client@example.com' },
                    attachments: [],
                },
            })
            .mockResolvedValueOnce({ data: { external: [] } });

        postMock.mockResolvedValueOnce({
            data: {
                thread: {
                    id: 99,
                    sender_name: 'You',
                    is_current_user: true,
                    content: '<p>Can you include filters?</p>',
                    created_at: '2026-02-09T12:02:00Z',
                    attachments: [],
                },
            },
        });

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        await wrapper.get('[data-testid="requirements-tab"]').trigger('click');
        await flushPromises();
        await nextTick();
        await wrapper.get('[data-testid="task-title-20"]').trigger('click');
        await flushPromises();
        await nextTick();

        expect(getMock).toHaveBeenCalledWith('/shift/api/tasks/20');
        expect(getMock).toHaveBeenCalledWith('/shift/api/tasks/20/threads');
        expect(wrapper.text()).toContain('Clarifications');

        const commentsEditor = wrapper.find('[data-testid="comments-editor"]');
        await commentsEditor.find('[data-testid="stub-send"]').trigger('click');
        await flushPromises();
        await nextTick();

        expect(postMock).toHaveBeenCalledWith('/shift/api/tasks/20/threads', expect.objectContaining({ content: '<p>hello</p>' }));

        wrapper.unmount();
        vi.useRealTimers();
    });
});
