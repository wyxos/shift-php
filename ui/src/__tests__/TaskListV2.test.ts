/* eslint-disable max-lines */
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import TaskListV2 from '../components/TaskListV2.vue';

const getMock = vi.fn();
const deleteMock = vi.fn();
const postMock = vi.fn();
const putMock = vi.fn();
const patchMock = vi.fn();
const sonnerMocks = vi.hoisted(() => ({
    toastLoadingMock: vi.fn(() => 'autosave-toast'),
    toastSuccessMock: vi.fn(),
    toastErrorMock: vi.fn(),
    toastDismissMock: vi.fn(),
}));

vi.mock('@/axios-config', () => ({
    default: {
        get: (...args: any[]) => getMock(...args),
        delete: (...args: any[]) => deleteMock(...args),
        post: (...args: any[]) => postMock(...args),
        put: (...args: any[]) => putMock(...args),
        patch: (...args: any[]) => patchMock(...args),
    },
}));

vi.mock('vue-router', () => ({
    useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('vue-sonner', () => ({
    toast: {
        loading: sonnerMocks.toastLoadingMock,
        success: sonnerMocks.toastSuccessMock,
        error: sonnerMocks.toastErrorMock,
        dismiss: sonnerMocks.toastDismissMock,
    },
}));

const stubs = {
    Button: { template: '<button v-bind="$attrs"><slot /></button>' },
    Card: { template: '<div><slot /></div>' },
    CardContent: { template: '<div><slot /></div>' },
    CardHeader: { template: '<div><slot /></div>' },
    CardTitle: { template: '<div><slot /></div>' },
    Dialog: { template: '<div><slot /></div>' },
    DialogContent: { template: '<div><slot /></div>' },
    Input: {
        props: ['modelValue'],
        template: '<input :value="modelValue" v-bind="$attrs" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    },
    Label: { template: '<label><slot /></label>' },
    Select: {
        props: ['modelValue'],
        template: '<select :value="modelValue" v-bind="$attrs" @change="$emit(\'update:modelValue\', $event.target.value)"><slot /></select>',
    },
    ShiftEditor: {
        props: ['modelValue'],
        template: `<div v-bind="$attrs">
      <button
        data-testid="stub-send"
        @click="$emit('send', { html: modelValue || '<p>hello</p>', attachments: [] })"
      >
        send
      </button>
    </div>`,
    },
    Sheet: { template: '<div><slot /></div>' },
    SheetContent: { template: '<div><slot /></div>' },
    SheetHeader: { template: '<div><slot /></div>' },
    SheetTitle: { template: '<div><slot /></div>' },
    SheetDescription: { template: '<div><slot /></div>' },
    SheetFooter: { template: '<div><slot /></div>' },
    SheetTrigger: { template: '<div><slot /></div>' },
    ImageLightbox: { template: '<div />' },
};

const seedTasks = [
    { id: 1, title: 'Auth issue', status: 'pending', priority: 'high', environment: 'staging' },
    { id: 2, title: 'UI polish', status: 'in-progress', priority: 'medium', environment: 'production' },
    { id: 3, title: 'Docs update', status: 'awaiting-feedback', priority: 'low', environment: null },
    { id: 4, title: 'Legacy cleanup', status: 'completed', priority: 'low', environment: 'production' },
    { id: 5, title: 'Close out', status: 'closed', priority: 'medium', environment: null },
];

const defaultStatuses = ['pending', 'in-progress', 'awaiting-feedback'];
const defaultTasks = seedTasks.filter((t) => defaultStatuses.includes(t.status));

function makeIndexResponse(tasks: any[]) {
    const total = tasks.length;
    return {
        data: {
            data: tasks,
            total,
            current_page: 1,
            last_page: 1,
            from: total ? 1 : 0,
            to: total,
        },
    };
}

async function mountWithTasks() {
    getMock.mockResolvedValueOnce(makeIndexResponse(defaultTasks));
    const wrapper = mount(TaskListV2, {
        global: { stubs },
    });
    await flushPromises();
    await nextTick();
    return wrapper;
}

describe('TaskListV2', () => {
    beforeEach(() => {
        vi.useRealTimers();
        window.history.replaceState({}, '', '/shift/tasks-v2');
        getMock.mockReset();
        deleteMock.mockReset();
        postMock.mockReset();
        putMock.mockReset();
        patchMock.mockReset();
        sonnerMocks.toastLoadingMock.mockClear();
        sonnerMocks.toastSuccessMock.mockClear();
        sonnerMocks.toastErrorMock.mockClear();
        sonnerMocks.toastDismissMock.mockClear();
    });

    it('defaults to excluding completed and closed statuses', async () => {
        const wrapper = await mountWithTasks();

        expect(getMock).toHaveBeenCalledWith('/shift/api/tasks', {
            params: { page: 1, status: defaultStatuses, sort_by: 'updated_at' },
        });

        const rows = wrapper.findAll('[data-testid="task-row"]');
        expect(rows.length).toBe(3);
        const text = rows.map((row) => row.text()).join(' ');
        expect(text).not.toContain('completed');
        expect(text).not.toContain('closed');

        wrapper.unmount();
    });

    it('uses distinct status badge colors for each status', async () => {
        getMock.mockResolvedValueOnce(makeIndexResponse(seedTasks));

        const wrapper = mount(TaskListV2, {
            global: { stubs },
        });
        await flushPromises();
        await nextTick();

        expect(wrapper.get('[data-testid="task-status-badge-1"]').classes()).toContain('bg-amber-100');
        expect(wrapper.get('[data-testid="task-status-badge-2"]').classes()).toContain('bg-sky-100');
        expect(wrapper.get('[data-testid="task-status-badge-3"]').classes()).toContain('bg-indigo-100');
        expect(wrapper.get('[data-testid="task-status-badge-4"]').classes()).toContain('bg-emerald-100');
        expect(wrapper.get('[data-testid="task-status-badge-5"]').classes()).toContain('bg-slate-100');

        wrapper.unmount();
    });

    it('uses distinct priority badge colors for each priority', async () => {
        getMock.mockResolvedValueOnce(makeIndexResponse(seedTasks));

        const wrapper = mount(TaskListV2, {
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

        const wrapper = mount(TaskListV2, {
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

        const wrapper = mount(TaskListV2, { global: { stubs } });
        await flushPromises();
        await nextTick();

        const firstRow = wrapper.findAll('[data-testid="task-row"]')[0];
        await firstRow.find('button[title="Edit"]').trigger('click');
        await flushPromises();
        await nextTick();

        expect(window.location.search).toContain('task=1');
        expect(pushStateSpy.mock.calls.some(([, , next]) => next === '/shift/tasks-v2?task=1')).toBe(true);

        (wrapper.vm as any).closeEditNow();
        await nextTick();

        expect(window.location.search).toBe('');
        expect(pushStateSpy.mock.calls.some(([, , next]) => next === '/shift/tasks-v2')).toBe(true);
        wrapper.unmount();
        pushStateSpy.mockRestore();
    });

    it('auto-opens the edit sheet from task URL query', async () => {
        window.history.replaceState({}, '', '/shift/tasks-v2?task=1');

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

        const wrapper = mount(TaskListV2, { global: { stubs } });
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

        const wrapper = mount(TaskListV2, { global: { stubs } });
        await flushPromises();
        await nextTick();

        window.history.replaceState({}, '', '/shift/tasks-v2?task=1');
        window.dispatchEvent(new PopStateEvent('popstate'));
        await flushPromises();
        await nextTick();

        expect(getMock).toHaveBeenCalledWith('/shift/api/tasks/1');

        window.history.replaceState({}, '', '/shift/tasks-v2');
        window.dispatchEvent(new PopStateEvent('popstate'));
        await flushPromises();
        await nextTick();

        expect(window.location.search).toBe('');
        expect((wrapper.vm as any).editOpen).toBe(false);
        wrapper.unmount();
    });

    it('filters by priority', async () => {
        getMock.mockResolvedValueOnce(makeIndexResponse(defaultTasks)).mockResolvedValueOnce(makeIndexResponse([seedTasks[0]]));

        const wrapper = mount(TaskListV2, { global: { stubs } });
        await flushPromises();
        await nextTick();

        await wrapper.get('[data-testid="priority-low"]').setValue(false);
        await wrapper.get('[data-testid="priority-medium"]').setValue(false);
        await nextTick();

        // Draft changes should not apply until the user clicks Apply.
        expect(wrapper.findAll('[data-testid="task-row"]').length).toBe(3);

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

        const wrapper = mount(TaskListV2, { global: { stubs } });
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

        const wrapper = mount(TaskListV2, { global: { stubs } });
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

        const wrapper = mount(TaskListV2, { global: { stubs } });
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

        const wrapper = mount(TaskListV2, { global: { stubs } });
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

        const wrapper = mount(TaskListV2, { global: { stubs } });
        await flushPromises();
        await nextTick();

        const firstRow = wrapper.findAll('[data-testid="task-row"]')[0];
        await firstRow.find('button[title="Edit"]').trigger('click');
        await flushPromises();
        await nextTick();

        expect(wrapper.get('[data-testid="edit-task-environment"]').text()).toContain('Staging');
        expect(wrapper.get('[data-testid="edit-task-created-by"]').text()).toContain('Taylor Brown');
        expect(wrapper.get('[data-testid="edit-task-updated-at"]').text()).toContain('Updated');
        expect(wrapper.get('[data-testid="task-status-pending"]').classes()).toContain('bg-amber-100');

        wrapper.unmount();
        vi.useRealTimers();
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

        const wrapper = mount(TaskListV2, { global: { stubs } });
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

        const wrapper = mount(TaskListV2, { global: { stubs } });
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

        const wrapper = mount(TaskListV2, { global: { stubs } });
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

        const wrapper = mount(TaskListV2, { global: { stubs } });
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
        expect(sonnerMocks.toastLoadingMock).toHaveBeenCalledWith('Saving task changes...');
        expect(sonnerMocks.toastSuccessMock).toHaveBeenCalledWith('Task changes saved', expect.objectContaining({ id: 'autosave-toast' }));

        wrapper.unmount();
        vi.useRealTimers();
    });

    it('posts a new comment and renders it in the list', async () => {
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
            .mockResolvedValueOnce({ data: { external: [] } }); // openEdit thread fetch

        postMock.mockResolvedValueOnce({
            data: {
                thread: {
                    id: 99,
                    sender_name: 'You',
                    is_current_user: true,
                    content: '<p>hello</p>',
                    created_at: '2026-02-09T12:02:00Z',
                    attachments: [],
                },
            },
        });

        const wrapper = mount(TaskListV2, { global: { stubs } });
        await flushPromises();
        await nextTick();

        const firstRow = wrapper.findAll('[data-testid="task-row"]')[0];
        await firstRow.find('button[title="Edit"]').trigger('click');
        await flushPromises();
        await nextTick();

        // click the stub send button (we have multiple editors; use the one marked comments-editor)
        const commentsEditor = wrapper.find('[data-testid="comments-editor"]');
        await commentsEditor.find('[data-testid="stub-send"]').trigger('click');
        await flushPromises();
        await nextTick();

        expect(postMock).toHaveBeenCalledWith('/shift/api/tasks/1/threads', expect.objectContaining({ content: '<p>hello</p>' }));
        expect(wrapper.text()).toContain('hello');

        wrapper.unmount();
        vi.useRealTimers();
    });

    it('allows the comment owner to edit their comment', async () => {
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

        putMock.mockResolvedValueOnce({
            data: {
                thread: {
                    id: 11,
                    sender_name: 'You',
                    is_current_user: true,
                    content: '<p>Edited</p>',
                    created_at: '2026-02-09T12:01:00Z',
                    attachments: [],
                },
            },
        });

        const wrapper = mount(TaskListV2, { global: { stubs } });
        await flushPromises();
        await nextTick();

        const firstRow = wrapper.findAll('[data-testid="task-row"]')[0];
        await firstRow.find('button[title="Edit"]').trigger('click');
        await flushPromises();
        await nextTick();

        await wrapper.get('[data-testid="comment-bubble-11"]').trigger('dblclick');
        await nextTick();

        const commentsEditor = wrapper.get('[data-testid="comments-editor"]');
        await commentsEditor.get('[data-testid="stub-send"]').trigger('click');
        await flushPromises();
        await nextTick();

        expect(putMock).toHaveBeenCalledWith(
            '/shift/api/tasks/1/threads/11',
            expect.objectContaining({ content: '<p>Second</p>', temp_identifier: expect.any(String) }),
        );
        expect(wrapper.text()).toContain('Edited');

        wrapper.unmount();
        vi.useRealTimers();
    });

    it('cancels comment edit on Escape', async () => {
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

        const wrapper = mount(TaskListV2, { global: { stubs } });
        await flushPromises();
        await nextTick();

        const firstRow = wrapper.findAll('[data-testid="task-row"]')[0];
        await firstRow.find('button[title="Edit"]').trigger('click');
        await flushPromises();
        await nextTick();

        await wrapper.get('[data-testid="comment-bubble-11"]').trigger('dblclick');
        await nextTick();

        const editor = wrapper.get('[data-testid="comments-editor"]');
        expect(editor.attributes('placeholder')).toBe('Edit your comment...');

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await nextTick();

        expect(editor.attributes('placeholder')).toBe('Write a comment...');

        wrapper.unmount();
        vi.useRealTimers();
    });

    it('copies the full text of a non-author comment', async () => {
        const writeTextMock = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: writeTextMock },
            configurable: true,
        });

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
                            id: 10,
                            sender_name: 'Alice',
                            is_current_user: false,
                            content: '<p>Hello <strong>team</strong></p>',
                            created_at: '2026-02-09T12:00:00Z',
                            attachments: [],
                        },
                    ],
                },
            });

        const wrapper = mount(TaskListV2, { global: { stubs } });
        await flushPromises();
        await nextTick();

        const firstRow = wrapper.findAll('[data-testid="task-row"]')[0];
        await firstRow.find('button[title="Edit"]').trigger('click');
        await flushPromises();
        await nextTick();

        const message = (wrapper.vm as any).threadMessages.find((item: any) => item.id === 10);
        await (wrapper.vm as any).copyEntireMessage(message);

        expect(writeTextMock).toHaveBeenCalledWith('Hello team');
        expect(sonnerMocks.toastSuccessMock).toHaveBeenCalledWith('Message copied');

        wrapper.unmount();
    });

    it('only enables copy selection when the selection belongs to that comment', async () => {
        const writeTextMock = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: writeTextMock },
            configurable: true,
        });

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
                            id: 10,
                            sender_name: 'Alice',
                            is_current_user: false,
                            content: '<p>Hello <strong>team</strong></p>',
                            created_at: '2026-02-09T12:00:00Z',
                            attachments: [],
                        },
                    ],
                },
            });

        const wrapper = mount(TaskListV2, { global: { stubs } });
        await flushPromises();
        await nextTick();

        const firstRow = wrapper.findAll('[data-testid="task-row"]')[0];
        await firstRow.find('button[title="Edit"]').trigger('click');
        await flushPromises();
        await nextTick();

        const message = (wrapper.vm as any).threadMessages.find((item: any) => item.id === 10);
        (wrapper.vm as any).contextMenuMessageId = 10;
        (wrapper.vm as any).contextMenuSelectionText = 'Hello';
        expect((wrapper.vm as any).shouldShowCopySelection(message)).toBe(true);

        await (wrapper.vm as any).copySelectedMessage();
        expect(writeTextMock).toHaveBeenCalledWith('Hello');
        expect(sonnerMocks.toastSuccessMock).toHaveBeenCalledWith('Selection copied');

        (wrapper.vm as any).contextMenuSelectionText = '';
        expect((wrapper.vm as any).shouldShowCopySelection(message)).toBe(false);
        wrapper.unmount();
    });

    it('replies to a comment by quoting and linking back to the original message', async () => {
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
                            id: 10,
                            sender_name: 'Alice',
                            is_current_user: false,
                            content: '<p>Original message</p>',
                            created_at: '2026-02-09T12:00:00Z',
                            attachments: [],
                        },
                    ],
                },
            });

        postMock.mockResolvedValueOnce({
            data: {
                thread: {
                    id: 12,
                    sender_name: 'You',
                    is_current_user: true,
                    content: '<p>Sent reply</p>',
                    created_at: '2026-02-09T12:03:00Z',
                    attachments: [],
                },
            },
        });

        const wrapper = mount(TaskListV2, { global: { stubs } });
        await flushPromises();
        await nextTick();

        const firstRow = wrapper.findAll('[data-testid="task-row"]')[0];
        await firstRow.find('button[title="Edit"]').trigger('click');
        await flushPromises();
        await nextTick();

        const message = (wrapper.vm as any).threadMessages.find((item: any) => item.id === 10);
        (wrapper.vm as any).startReplyToMessage(message);
        await flushPromises();
        await nextTick();

        const composerHtml = (wrapper.vm as any).threadComposerHtml as string;
        expect(composerHtml).toContain('class="shift-reply"');
        expect(composerHtml).toContain('data-reply-to="10"');

        const commentsEditor = wrapper.get('[data-testid="comments-editor"]');
        await commentsEditor.get('[data-testid="stub-send"]').trigger('click');
        await flushPromises();
        await nextTick();

        expect(postMock).toHaveBeenCalledWith(
            '/shift/api/tasks/1/threads',
            expect.objectContaining({
                content: expect.stringContaining('data-reply-to="10"'),
            }),
        );

        wrapper.unmount();
    });

    it('appends multiple replies into the same draft instead of replacing previous content', async () => {
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
                            id: 10,
                            sender_name: 'Alice',
                            is_current_user: false,
                            content: '<p>First message</p>',
                            created_at: '2026-02-09T12:00:00Z',
                            attachments: [],
                        },
                        {
                            id: 13,
                            sender_name: 'Bob',
                            is_current_user: false,
                            content: '<p>Second message</p>',
                            created_at: '2026-02-09T12:02:00Z',
                            attachments: [],
                        },
                    ],
                },
            });

        const wrapper = mount(TaskListV2, { global: { stubs } });
        await flushPromises();
        await nextTick();

        const firstRow = wrapper.findAll('[data-testid="task-row"]')[0];
        await firstRow.find('button[title="Edit"]').trigger('click');
        await flushPromises();
        await nextTick();

        const firstMessage = (wrapper.vm as any).threadMessages.find((item: any) => item.id === 10);
        const secondMessage = (wrapper.vm as any).threadMessages.find((item: any) => item.id === 13);

        (wrapper.vm as any).startReplyToMessage(firstMessage);
        await flushPromises();
        await nextTick();
        (wrapper.vm as any).threadComposerHtml = `${(wrapper.vm as any).threadComposerHtml}<p>stuff</p>`;

        (wrapper.vm as any).startReplyToMessage(secondMessage);
        await flushPromises();
        await nextTick();

        const composerHtml = (wrapper.vm as any).threadComposerHtml as string;
        const replyMatches = composerHtml.match(/data-reply-to="/g) ?? [];

        expect(replyMatches.length).toBe(2);
        expect(composerHtml).toContain('data-reply-to="10"');
        expect(composerHtml).toContain('data-reply-to="13"');
        expect(composerHtml.indexOf('data-reply-to="10"')).toBeLessThan(composerHtml.indexOf('data-reply-to="13"'));
        expect(composerHtml).toContain('<p>stuff</p>');

        wrapper.unmount();
    });

    it('scrolls and highlights the original comment when clicking a reply quote reference', async () => {
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
                            id: 10,
                            sender_name: 'Alice',
                            is_current_user: false,
                            content: '<p>Original message</p>',
                            created_at: '2026-02-09T12:00:00Z',
                            attachments: [],
                        },
                        {
                            id: 11,
                            sender_name: 'Bob',
                            is_current_user: false,
                            content:
                                '<blockquote class="shift-reply" data-reply-to="10"><p>Replying to Alice</p><p>Original message</p></blockquote><p>Follow up</p>',
                            created_at: '2026-02-09T12:03:00Z',
                            attachments: [],
                        },
                    ],
                },
            });

        const wrapper = mount(TaskListV2, { global: { stubs } });
        await flushPromises();
        await nextTick();

        const firstRow = wrapper.findAll('[data-testid="task-row"]')[0];
        await firstRow.find('button[title="Edit"]').trigger('click');
        await flushPromises();
        await nextTick();

        const originBubble = wrapper.get('[data-testid="comment-bubble-10"]').element as HTMLElement;
        const originalScrollIntoView = (HTMLElement.prototype as any).scrollIntoView;
        const scrollIntoViewMock = vi.fn();
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
            value: scrollIntoViewMock,
            configurable: true,
            writable: true,
        });

        const quoteElement = wrapper.get('[data-testid="comment-bubble-11"] blockquote[data-reply-to]').element as HTMLElement;
        const preventDefault = vi.fn();
        const stopPropagation = vi.fn();

        (wrapper.vm as any).onGlobalClickCapture({
            target: quoteElement,
            preventDefault,
            stopPropagation,
        } as unknown as MouseEvent);
        await flushPromises();
        await nextTick();

        expect(scrollIntoViewMock).toHaveBeenCalledWith({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest',
        });
        expect(originBubble.classList.contains('shift-reply-target')).toBe(true);
        expect(preventDefault).toHaveBeenCalled();
        expect(stopPropagation).toHaveBeenCalled();

        if (originalScrollIntoView) {
            Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
                value: originalScrollIntoView,
                configurable: true,
                writable: true,
            });
        } else {
            delete (HTMLElement.prototype as any).scrollIntoView;
        }

        wrapper.unmount();
    });
});
