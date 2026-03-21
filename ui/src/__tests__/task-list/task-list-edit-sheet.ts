import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import {
    defaultStatuses,
    defaultTasks,
    getMock,
    makeIndexResponse,
    patchMock,
    putMock,
    resetTaskListTestState,
    stubs,
    toastMocks,
} from './test-helpers';
import TaskList from '../../components/TaskList.vue';

describe('TaskList edit sheet', () => {
    beforeEach(resetTaskListTestState);

    it('loads comments when opening the edit sheet', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-10T18:00:00Z'));

        getMock
            .mockResolvedValueOnce(makeIndexResponse(defaultTasks)) // initial fetchTasks on mount
            .mockResolvedValueOnce({
                data: {
                    id: 1,
                    title: 'Auth issue',
                    priority: 'high',
                    created_at: '2026-02-10T17:40:00Z',
                    description: '',
                    submitter: { email: 'someone@example.com' },
                    attachments: [],
                },
            }) // openEdit task fetch
            .mockResolvedValueOnce({
                data: {
                    external: [
                        {
                            id: 10,
                            sender_name: 'Alice',
                            is_current_user: false,
                            content: '<p>First</p>',
                            created_at: '2026-02-09T12:00:00Z',
                            attachments: [],
                        },
                        {
                            id: 11,
                            sender_name: 'You',
                            is_current_user: true,
                            content: '<p>Second</p>',
                            created_at: '2026-02-09T12:01:00Z',
                            attachments: [],
                        },
                    ],
                },
            }); // openEdit thread fetch

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        const firstRow = wrapper.findAll('[data-testid="task-row"]')[0];
        await firstRow.find('button[title="Edit"]').trigger('click');
        await flushPromises();
        await nextTick();

        expect(getMock).toHaveBeenCalledWith('/shift/api/tasks/1');
        expect(getMock).toHaveBeenCalledWith('/shift/api/tasks/1/threads');
        expect(wrapper.text()).toContain('Created');
        expect(wrapper.text()).toContain('Comments');
        expect(wrapper.text()).toContain('First');
        expect(wrapper.text()).toContain('Second');

        wrapper.unmount();
        vi.useRealTimers();
    });

    it('shows creator and environment details in the edit sheet', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-10T18:00:00Z'));

        getMock
            .mockResolvedValueOnce(makeIndexResponse(defaultTasks)) // initial fetchTasks on mount
            .mockResolvedValueOnce({
                data: {
                    id: 1,
                    title: 'Auth issue',
                    priority: 'high',
                    status: 'pending',
                    environment: 'staging',
                    created_at: '2026-02-10T17:40:00Z',
                    updated_at: '2026-02-10T17:55:00Z',
                    description: '',
                    submitter: { name: 'Taylor Brown', email: 'someone@example.com' },
                    attachments: [],
                },
            }) // openEdit task fetch
            .mockResolvedValueOnce({ data: { external: [] } }); // openEdit thread fetch

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        const firstRow = wrapper.findAll('[data-testid="task-row"]')[0];
        await firstRow.find('button[title="Edit"]').trigger('click');
        await flushPromises();
        await nextTick();

        const editStatusGroup = wrapper.get('[aria-label="Task status"]');
        const mobilePaneGroup = wrapper.get('[aria-label="Edit task section"]');

        expect(wrapper.get('[data-testid="edit-task-environment"]').text()).toContain('Staging');
        expect(wrapper.find('[data-testid="edit-task-environment-select"]').exists()).toBe(false);
        expect(wrapper.get('[data-testid="edit-task-created-by"]').text()).toContain('Taylor Brown');
        expect(wrapper.get('[data-testid="edit-task-updated-at"]').text()).toContain('Updated');
        expect(editStatusGroup.classes()).toContain('grid');
        expect(editStatusGroup.classes()).toContain('grid-cols-2');
        expect(editStatusGroup.classes()).toContain('xl:grid-cols-4');
        expect(mobilePaneGroup.classes()).toContain('grid-cols-2');
        expect(wrapper.get('[data-testid="edit-mobile-pane-details"]').text()).toContain('Details');
        expect(wrapper.get('[data-testid="edit-mobile-pane-comments"]').text()).toContain('Comments');
        expect(wrapper.get('[data-testid="task-status-pending"]').classes()).toContain('bg-amber-100');

        wrapper.unmount();
        vi.useRealTimers();
    });

    it('renders the owner priority buttons in a 3-column group inside the edit sheet', async () => {
        (window as any).shiftConfig = { email: 'someone@example.com' };

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
        await firstRow.find('button[title="Edit"]').trigger('click');
        await flushPromises();
        await nextTick();

        const editPriorityGroup = wrapper.get('[aria-label="Task priority"]');
        expect(editPriorityGroup.classes()).toContain('grid');
        expect(editPriorityGroup.classes()).toContain('grid-cols-3');
        expect(wrapper.get('[data-testid="task-priority-high"]').classes()).toContain('bg-rose-100');

        wrapper.unmount();
    });

    it('renders markdown list comments as list HTML', async () => {
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
            .mockResolvedValueOnce({
                data: {
                    external: [
                        {
                            id: 11,
                            sender_name: 'You',
                            is_current_user: true,
                            content: '- first\n- second',
                            created_at: '2026-02-09T12:01:00Z',
                            attachments: [],
                        },
                    ],
                },
            });

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        const firstRow = wrapper.findAll('[data-testid="task-row"]')[0];
        await firstRow.find('button[title="Edit"]').trigger('click');
        await flushPromises();
        await nextTick();

        const commentHtml = wrapper.get('[data-testid="comment-bubble-11"]').html();
        expect(commentHtml).toContain('<ul>');
        expect(commentHtml).toMatch(/<li>first<\/li>/i);
        expect(commentHtml).toMatch(/<li>second<\/li>/i);

        wrapper.unmount();
    });

    it('normalizes legacy list HTML comments with br-separated markers', async () => {
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
            .mockResolvedValueOnce({
                data: {
                    external: [
                        {
                            id: 11,
                            sender_name: 'You',
                            is_current_user: true,
                            content: '<ul><li><p>test<br>- test</p></li></ul>',
                            created_at: '2026-02-09T12:01:00Z',
                            attachments: [],
                        },
                    ],
                },
            });

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        const firstRow = wrapper.findAll('[data-testid="task-row"]')[0];
        await firstRow.find('button[title="Edit"]').trigger('click');
        await flushPromises();
        await nextTick();

        const commentHtml = wrapper.get('[data-testid="comment-bubble-11"]').html();
        const liMatches = commentHtml.match(/<li>/g) ?? [];
        expect(commentHtml).toContain('<ul>');
        expect(liMatches.length).toBe(2);

        wrapper.unmount();
    });

    it('renders inline code in comments for backtick-wrapped text', async () => {
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
            .mockResolvedValueOnce({
                data: {
                    external: [
                        {
                            id: 11,
                            sender_name: 'You',
                            is_current_user: true,
                            content: 'Use `this quote` text',
                            created_at: '2026-02-09T12:01:00Z',
                            attachments: [],
                        },
                    ],
                },
            });

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        const firstRow = wrapper.findAll('[data-testid="task-row"]')[0];
        await firstRow.find('button[title="Edit"]').trigger('click');
        await flushPromises();
        await nextTick();

        const commentHtml = wrapper.get('[data-testid="comment-bubble-11"]').html();
        expect(commentHtml).toContain('<code>');
        expect(commentHtml).toContain('this quote');

        wrapper.unmount();
    });

    it('allows any user to change task status from the edit sheet', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-10T18:00:00Z'));

        getMock
            .mockResolvedValueOnce(makeIndexResponse(defaultTasks)) // initial fetchTasks on mount
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
            }) // openEdit task fetch
            .mockResolvedValueOnce({ data: { external: [] } }) // openEdit thread fetch
            .mockResolvedValueOnce(makeIndexResponse(defaultTasks)); // refresh after save

        putMock.mockResolvedValueOnce({
            data: {
                task: {
                    id: 1,
                    title: 'Auth issue',
                    priority: 'high',
                    status: 'in-progress',
                    description: '',
                    created_at: '2026-02-10T17:40:00Z',
                    updated_at: '2026-02-10T18:00:00Z',
                    attachments: [],
                },
            },
        });

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        const firstRow = wrapper.findAll('[data-testid="task-row"]')[0];
        await firstRow.find('button[title="Edit"]').trigger('click');
        await flushPromises();
        await nextTick();

        await wrapper.get('[data-testid="task-status-in-progress"]').trigger('click');
        await flushPromises();
        await nextTick();
        expect(wrapper.get('[data-testid="task-status-in-progress"]').classes()).toContain('bg-sky-100');

        expect(patchMock).not.toHaveBeenCalled();
        vi.advanceTimersByTime(800);
        await flushPromises();
        await nextTick();

        expect(putMock).toHaveBeenCalledWith('/shift/api/tasks/1', expect.objectContaining({ status: 'in-progress' }));
        expect(getMock).toHaveBeenLastCalledWith('/shift/api/tasks', {
            params: { page: 1, status: defaultStatuses, sort_by: 'updated_at' },
        });
        expect(toastMocks.toastLoadingMock).toHaveBeenCalledWith('Saving task changes...');
        expect(toastMocks.toastSuccessMock).toHaveBeenCalledWith('Task changes saved', expect.objectContaining({ id: 'autosave-toast' }));

        wrapper.unmount();
        vi.useRealTimers();
    });

});
