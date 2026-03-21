import { flushPromises, mount } from '@vue/test-utils';
import { vi } from 'vitest';
import { nextTick } from 'vue';
import TaskList from '../../components/TaskList.vue';

export const getMock = vi.fn();
export const deleteMock = vi.fn();
export const postMock = vi.fn();
export const putMock = vi.fn();
export const patchMock = vi.fn();
const sonnerMocks = vi.hoisted(() => ({
    toastLoadingMock: vi.fn(() => 'autosave-toast'),
    toastSuccessMock: vi.fn(),
    toastErrorMock: vi.fn(),
    toastDismissMock: vi.fn(),
}));

export const toastMocks = sonnerMocks;

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

export const stubs = {
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
      <textarea
        data-testid="stub-editor-input"
        :value="modelValue"
        @input="$emit('update:modelValue', $event.target.value)"
      />
      <button
        data-testid="stub-send"
        @click="$emit('send', { html: modelValue || '<p>hello</p>', attachments: [] })"
      >
        send
      </button>
    </div>`,
    },
    TaskCollaboratorField: {
        props: ['modelValue', 'readOnly'],
        template: `<div data-testid="stub-task-collaborators" :data-read-only="String(Boolean(readOnly))">
      <button
        data-testid="stub-add-internal-collaborator"
        @click="$emit('update:modelValue', { internal: [{ id: 77, name: 'Shift User', email: 'shift@example.com' }], external: (modelValue && modelValue.external) || [] })"
      >
        add internal
      </button>
      <button
        data-testid="stub-add-external-collaborator"
        @click="$emit('update:modelValue', { internal: (modelValue && modelValue.internal) || [], external: [{ id: 'client-2', name: 'Project User', email: 'project@example.com' }] })"
      >
        add external
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

export const seedTasks = [
    { id: 1, title: 'Auth issue', status: 'pending', priority: 'high', environment: 'staging' },
    { id: 2, title: 'UI polish', status: 'in-progress', priority: 'medium', environment: 'production' },
    { id: 3, title: 'Docs update', status: 'awaiting-feedback', priority: 'low', environment: null },
    { id: 4, title: 'Legacy cleanup', status: 'completed', priority: 'low', environment: 'production' },
    { id: 5, title: 'Close out', status: 'closed', priority: 'medium', environment: null },
];

export const defaultStatuses = ['pending', 'in-progress', 'awaiting-feedback'];
export const defaultTasks = seedTasks.filter((t) => defaultStatuses.includes(t.status));

export function makeIndexResponse(tasks: any[]) {
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

export async function mountTaskList() {
    getMock.mockResolvedValueOnce(makeIndexResponse(defaultTasks));
    const wrapper = mount(TaskList, {
        global: { stubs },
    });
    await flushPromises();
    await nextTick();
    return wrapper;
}

export { mountTaskList as mountWithTasks };

export function resetTaskListTestState() {
    vi.useRealTimers();
    window.history.replaceState({}, '', '/shift/tasks');
    (window as any).shiftConfig = { appEnvironment: 'local' };
    getMock.mockReset();
    deleteMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    patchMock.mockReset();
    sonnerMocks.toastLoadingMock.mockClear();
    sonnerMocks.toastSuccessMock.mockClear();
    sonnerMocks.toastErrorMock.mockClear();
    sonnerMocks.toastDismissMock.mockClear();
}
