import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import TaskList from '../../components/TaskList.vue';
import {
    defaultRequirementStatuses,
    defaultStatuses,
    defaultTasks,
    getMock,
    makeIndexResponse,
    postMock,
    putMock,
    resetTaskListTestState,
    stubs,
} from './test-helpers';

const requirementItems = [
    {
        id: 20,
        title: 'Portal reporting',
        status: 'pending',
        requirement_status: 'submitted',
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
        requirement_status: 'parked',
        priority: 'medium',
        phase: 'requirement',
        finalized: false,
        environment: 'staging',
        batch: {
            id: 5,
            title: 'June scope',
            total_items: 2,
            requirement_items: 1,
            ready_items: 0,
            finalized_items: 1,
        },
    },
    {
        id: 21,
        title: 'CSV export',
        status: 'pending',
        requirement_status: 'ready-to-finalize',
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
            ready_items: 0,
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
            params: { page: 1, sort_by: 'updated_at' },
        });
        expect(wrapper.text()).toContain('Portal reporting');
        expect(wrapper.text()).toContain('Submitted');
        expect(wrapper.text()).toContain('New Requirements');
        expect(wrapper.text()).not.toContain('Auth issue');
        expect(wrapper.find('[data-testid="open-requirement-pack"]').exists()).toBe(true);

        wrapper.unmount();
    });

    it('shows requirement group counts and finalized item state', async () => {
        getMock.mockResolvedValueOnce(makeIndexResponse(defaultTasks)).mockResolvedValueOnce(makeIndexResponse(mixedRequirementItems));

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        await wrapper.get('[data-testid="requirements-tab"]').trigger('click');
        await flushPromises();
        await nextTick();

        expect(wrapper.text()).toContain('June scope');
        expect(wrapper.text()).toContain('2 items · 1 open · 0 ready · 1 finalized');
        expect(wrapper.text()).toContain('Portal reporting');
        expect(wrapper.text()).toContain('Parked');
        expect(wrapper.text()).toContain('CSV export');
        expect(wrapper.get('[data-testid="task-status-badge-21"]').text()).toContain('Finalized');
        expect(wrapper.get('[data-testid="task-status-badge-20"]').text()).toContain('Parked');

        wrapper.unmount();
    });

    it('uses the requirements route as the initial surface', async () => {
        window.history.replaceState({}, '', '/shift/requirements');
        getMock.mockResolvedValueOnce(makeIndexResponse(requirementItems));

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        expect(getMock).toHaveBeenCalledWith('/shift/api/requirements', {
            params: { page: 1, sort_by: 'updated_at' },
        });
        expect(wrapper.get('[data-testid="requirements-tab"]').attributes('aria-selected')).toBe('true');
        expect(wrapper.text()).toContain('Portal reporting');

        wrapper.unmount();
    });

    it('filters requirements by lifecycle state', async () => {
        window.history.replaceState({}, '', '/shift/requirements');
        getMock
            .mockResolvedValueOnce(makeIndexResponse(requirementItems))
            .mockResolvedValueOnce(makeIndexResponse(mixedRequirementItems.slice(0, 1)));

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        for (const status of defaultRequirementStatuses.filter((value) => value !== 'parked')) {
            await wrapper.get(`[data-testid="status-${status}"]`).setValue(false);
        }
        await nextTick();
        await wrapper.get('[data-testid="filters-apply"]').trigger('click');
        await flushPromises();
        await nextTick();

        expect(getMock).toHaveBeenLastCalledWith('/shift/api/requirements', {
            params: { page: 1, status: ['parked'], sort_by: 'updated_at' },
        });

        wrapper.unmount();
    });

    it('updates the route when switching between task and requirement tabs', async () => {
        getMock.mockResolvedValueOnce(makeIndexResponse(defaultTasks)).mockResolvedValueOnce(makeIndexResponse(requirementItems));

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        expect(wrapper.get('[data-testid="tasks-tab"]').element.tagName).toBe('A');
        expect(wrapper.get('[data-testid="tasks-tab"]').attributes('href')).toBe('/shift/tasks');
        expect(wrapper.get('[data-testid="requirements-tab"]').element.tagName).toBe('A');
        expect(wrapper.get('[data-testid="requirements-tab"]').attributes('href')).toBe('/shift/requirements');

        await wrapper.get('[data-testid="requirements-tab"]').trigger('click');
        await flushPromises();
        await nextTick();

        expect(window.location.pathname).toBe('/shift/requirements');
        expect(getMock).toHaveBeenLastCalledWith('/shift/api/requirements', {
            params: { page: 1, sort_by: 'updated_at' },
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

        expect(wrapper.text()).toContain('New requirements');
        expect(wrapper.get('[data-testid="requirement-pack-title"]').attributes('required')).toBeDefined();
        expect(wrapper.get('[data-testid="requirement-pack-title"]').attributes('placeholder')).toContain('-requirements');
        expect(wrapper.text()).toContain('Submit Requirements');
        expect(wrapper.find('[data-testid="requirement-item-0"]').exists()).toBe(false);

        await wrapper.get('[data-testid="requirement-pack-title"]').setValue('June scope');
        await wrapper.get('[data-testid="add-requirement-item-empty"]').trigger('click');
        await nextTick();
        await wrapper.get('[data-testid="requirement-item-title-0"]').setValue('Portal reporting');
        await wrapper.get('[data-testid="requirement-item-description-0"] [data-testid="stub-editor-input"]').setValue('Need a dashboard');
        await wrapper.get('[data-testid="add-requirement-item"]').trigger('click');
        await nextTick();
        await wrapper.get('[data-testid="requirement-item-title-1"]').setValue('Export flow');
        await wrapper.get('[data-testid="requirement-item-description-1"] [data-testid="stub-editor-input"]').setValue('Need CSV export');
        await wrapper.get('[data-testid="requirement-pack-form"]').trigger('submit');
        await flushPromises();
        await nextTick();

        expect(postMock).toHaveBeenCalledWith('/shift/api/requirements/batches', {
            title: 'June scope',
            items: [
                {
                    title: 'Portal reporting',
                    description: 'Need a dashboard',
                    temp_identifier: expect.stringMatching(/^requirement-/),
                },
                {
                    title: 'Export flow',
                    description: 'Need CSV export',
                    temp_identifier: expect.stringMatching(/^requirement-/),
                },
            ],
            internal_collaborator_ids: [],
            external_collaborators: [],
        });
        expect(getMock).toHaveBeenLastCalledWith('/shift/api/requirements', {
            params: { page: 1, sort_by: 'updated_at' },
        });
        expect(wrapper.get('[data-testid="task-row"]').classes()).toContain('ring-2');

        wrapper.unmount();
    });

    it('can apply requirement collaborators globally or per requirement', async () => {
        getMock
            .mockResolvedValueOnce(makeIndexResponse(defaultTasks))
            .mockResolvedValueOnce(makeIndexResponse([]))
            .mockResolvedValueOnce(makeIndexResponse(requirementItems))
            .mockResolvedValueOnce(makeIndexResponse(requirementItems));

        postMock
            .mockResolvedValueOnce({
                data: {
                    batch: { id: 5, title: 'Global collaborators' },
                    items: requirementItems,
                },
            })
            .mockResolvedValueOnce({
                data: {
                    batch: { id: 6, title: 'Per item collaborators' },
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

        let form = wrapper.get('[data-testid="requirement-pack-form"]');
        await form.get('[data-testid="stub-add-internal-collaborator"]').trigger('click');
        await form.get('[data-testid="stub-add-external-collaborator"]').trigger('click');
        await form.get('[data-testid="requirement-pack-title"]').setValue('Global collaborators');
        await form.get('[data-testid="add-requirement-item-empty"]').trigger('click');
        await nextTick();
        form = wrapper.get('[data-testid="requirement-pack-form"]');
        await form.get('[data-testid="requirement-item-title-0"]').setValue('Portal reporting');
        await form.get('[data-testid="requirement-item-description-0"] [data-testid="stub-editor-input"]').setValue('Need a dashboard');
        await form.trigger('submit');
        await flushPromises();
        await nextTick();

        expect(postMock).toHaveBeenLastCalledWith(
            '/shift/api/requirements/batches',
            expect.objectContaining({
                title: 'Global collaborators',
                internal_collaborator_ids: [77],
                external_collaborators: [
                    {
                        id: 'client-2',
                        name: 'Project User',
                        email: 'project@example.com',
                    },
                ],
                items: [
                    expect.not.objectContaining({
                        internal_collaborator_ids: expect.any(Array),
                    }),
                ],
            }),
        );

        await wrapper.get('[data-testid="open-requirement-pack"]').trigger('click');
        await nextTick();

        form = wrapper.get('[data-testid="requirement-pack-form"]');
        await form.get('[data-testid="requirement-collaborator-mode-toggle"]').trigger('click');
        await form.get('[data-testid="requirement-pack-title"]').setValue('Per item collaborators');
        await form.get('[data-testid="add-requirement-item-empty"]').trigger('click');
        await nextTick();
        form = wrapper.get('[data-testid="requirement-pack-form"]');
        await form.get('[data-testid="requirement-item-title-0"]').setValue('Export flow');
        await form.get('[data-testid="requirement-item-description-0"] [data-testid="stub-editor-input"]').setValue('Need CSV export');
        const itemCollaboratorStub = form.findAll('[data-testid="stub-task-collaborators"]')[0];
        await itemCollaboratorStub.get('[data-testid="stub-add-internal-collaborator"]').trigger('click');
        await itemCollaboratorStub.get('[data-testid="stub-add-external-collaborator"]').trigger('click');
        await form.trigger('submit');
        await flushPromises();
        await nextTick();

        expect(postMock).toHaveBeenLastCalledWith('/shift/api/requirements/batches', {
            title: 'Per item collaborators',
            items: [
                expect.objectContaining({
                    title: 'Export flow',
                    description: 'Need CSV export',
                    internal_collaborator_ids: [77],
                    external_collaborators: [
                        {
                            id: 'client-2',
                            name: 'Project User',
                            email: 'project@example.com',
                        },
                    ],
                }),
            ],
        });

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
                    requirement_status: 'submitted',
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
        expect(wrapper.get('[data-testid="task-edit-sheet-title"]').text()).toBe('Portal reporting');
        expect(wrapper.text()).toContain('Clarifications');
        expect(wrapper.text()).toContain('Requirement state');
        expect(wrapper.get('[data-testid="requirement-status-submitted"]').classes()).toContain('bg-slate-100');
        expect(wrapper.find('[aria-label="Task status"]').exists()).toBe(false);

        const commentsEditor = wrapper.find('[data-testid="comments-editor"]');
        await commentsEditor.find('[data-testid="stub-send"]').trigger('click');
        await flushPromises();
        await nextTick();

        expect(postMock).toHaveBeenCalledWith('/shift/api/tasks/20/threads', expect.objectContaining({ content: '<p>hello</p>' }));

        wrapper.unmount();
        vi.useRealTimers();
    });

    it('autosaves requirement lifecycle changes through the task update endpoint', async () => {
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
                    requirement_status: 'submitted',
                    phase: 'requirement',
                    created_at: '2026-02-10T17:40:00Z',
                    description: 'Need a dashboard',
                    submitter: { email: 'client@example.com' },
                    attachments: [],
                },
            })
            .mockResolvedValueOnce({ data: { external: [] } })
            .mockResolvedValueOnce(makeIndexResponse([{ ...requirementItems[0], requirement_status: 'parked' }]));

        putMock.mockResolvedValueOnce({
            data: {
                task: {
                    id: 20,
                    title: 'Portal reporting',
                    priority: 'medium',
                    status: 'pending',
                    requirement_status: 'parked',
                    phase: 'requirement',
                    description: 'Need a dashboard',
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

        await wrapper.get('[data-testid="requirement-status-parked"]').trigger('click');
        await flushPromises();
        await nextTick();
        expect(wrapper.get('[data-testid="requirement-status-parked"]').classes()).toContain('bg-orange-100');

        vi.advanceTimersByTime(800);
        await flushPromises();
        await nextTick();

        expect(putMock).toHaveBeenCalledWith('/shift/api/tasks/20', expect.objectContaining({ requirement_status: 'parked' }));
        expect(getMock).toHaveBeenLastCalledWith('/shift/api/requirements', {
            params: { page: 1, sort_by: 'updated_at' },
        });

        wrapper.unmount();
        vi.useRealTimers();
    });
});
