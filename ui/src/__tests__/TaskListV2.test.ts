import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import TaskListV2 from '../components/TaskListV2.vue'

const getMock = vi.fn()
const deleteMock = vi.fn()
const postMock = vi.fn()
const putMock = vi.fn()

vi.mock('@/axios-config', () => ({
  default: {
    get: (...args: any[]) => getMock(...args),
    delete: (...args: any[]) => deleteMock(...args),
    post: (...args: any[]) => postMock(...args),
    put: (...args: any[]) => putMock(...args),
  },
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const stubs = {
  Button: { template: '<button v-bind="$attrs"><slot /></button>' },
  Card: { template: '<div><slot /></div>' },
  CardContent: { template: '<div><slot /></div>' },
  CardHeader: { template: '<div><slot /></div>' },
  CardTitle: { template: '<div><slot /></div>' },
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
}

const seedTasks = [
  { id: 1, title: 'Auth issue', status: 'pending', priority: 'high' },
  { id: 2, title: 'UI polish', status: 'in-progress', priority: 'medium' },
  { id: 3, title: 'Docs update', status: 'awaiting-feedback', priority: 'low' },
  { id: 4, title: 'Legacy cleanup', status: 'completed', priority: 'low' },
  { id: 5, title: 'Close out', status: 'closed', priority: 'medium' },
]

async function mountWithTasks() {
  getMock.mockResolvedValue({ data: { data: seedTasks } })
  const wrapper = mount(TaskListV2, {
    global: { stubs },
  })
  await flushPromises()
  await nextTick()
  return wrapper
}

describe('TaskListV2', () => {
  beforeEach(() => {
    vi.useRealTimers()
    getMock.mockReset()
    deleteMock.mockReset()
    postMock.mockReset()
    putMock.mockReset()
  })

  it('defaults to excluding completed and closed statuses', async () => {
    const wrapper = await mountWithTasks()

    expect(getMock).toHaveBeenCalledWith('/shift/api/tasks', {
      params: { status: ['pending', 'in-progress', 'awaiting-feedback'] },
    })

    const rows = wrapper.findAll('[data-testid="task-row"]')
    expect(rows.length).toBe(3)
    const text = rows.map((row) => row.text()).join(' ')
    expect(text).not.toContain('completed')
    expect(text).not.toContain('closed')
  })

  it('filters by priority', async () => {
    const wrapper = await mountWithTasks()

    await wrapper.get('[data-testid="priority-low"]').setValue(false)
    await wrapper.get('[data-testid="priority-medium"]').setValue(false)
    await nextTick()

    const rows = wrapper.findAll('[data-testid="task-row"]')
    expect(rows.length).toBe(1)
    expect(rows[0].text()).toContain('high')
  })

  it('filters by search term', async () => {
    const wrapper = await mountWithTasks()

    await wrapper.get('[data-testid="filter-search"]').setValue('auth')
    await nextTick()

    const rows = wrapper.findAll('[data-testid="task-row"]')
    expect(rows.length).toBe(1)
    expect(rows[0].text()).toContain('Auth issue')
  })

  it('loads comments when opening the edit sheet', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-10T18:00:00Z'))

    getMock
      .mockResolvedValueOnce({ data: { data: seedTasks } }) // initial fetchTasks on mount
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
      }) // openEdit thread fetch

    const wrapper = mount(TaskListV2, { global: { stubs } })
    await flushPromises()
    await nextTick()

    const firstRow = wrapper.findAll('[data-testid="task-row"]')[0]
    await firstRow.find('button[title="Edit"]').trigger('click')
    await flushPromises()
    await nextTick()

    expect(getMock).toHaveBeenCalledWith('/shift/api/tasks/1')
    expect(getMock).toHaveBeenCalledWith('/shift/api/tasks/1/threads')
    expect(wrapper.text()).toContain('Created')
    expect(wrapper.text()).toContain('Comments')
    expect(wrapper.text()).toContain('First')
    expect(wrapper.text()).toContain('Second')
  })

  it('posts a new comment and renders it in the list', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-10T18:00:00Z'))

    getMock
      .mockResolvedValueOnce({ data: { data: seedTasks } }) // initial fetchTasks on mount
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
      .mockResolvedValueOnce({ data: { external: [] } }) // openEdit thread fetch

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
    })

    const wrapper = mount(TaskListV2, { global: { stubs } })
    await flushPromises()
    await nextTick()

    const firstRow = wrapper.findAll('[data-testid="task-row"]')[0]
    await firstRow.find('button[title="Edit"]').trigger('click')
    await flushPromises()
    await nextTick()

    // click the stub send button (we have multiple editors; use the one marked comments-editor)
    const commentsEditor = wrapper.find('[data-testid="comments-editor"]')
    await commentsEditor.find('[data-testid="stub-send"]').trigger('click')
    await flushPromises()
    await nextTick()

    expect(postMock).toHaveBeenCalledWith('/shift/api/tasks/1/threads', expect.objectContaining({ content: '<p>hello</p>' }))
    expect(wrapper.text()).toContain('hello')
  })

  it('allows the comment owner to edit their comment', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-10T18:00:00Z'))

    getMock
      .mockResolvedValueOnce({ data: { data: seedTasks } }) // initial fetchTasks on mount
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
      }) // openEdit thread fetch

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
    })

    const wrapper = mount(TaskListV2, { global: { stubs } })
    await flushPromises()
    await nextTick()

    const firstRow = wrapper.findAll('[data-testid="task-row"]')[0]
    await firstRow.find('button[title="Edit"]').trigger('click')
    await flushPromises()
    await nextTick()

    await wrapper.get('[data-testid="comment-bubble-11"]').trigger('dblclick')
    await nextTick()

    const commentsEditor = wrapper.get('[data-testid="comments-editor"]')
    await commentsEditor.get('[data-testid="stub-send"]').trigger('click')
    await flushPromises()
    await nextTick()

    expect(putMock).toHaveBeenCalledWith(
      '/shift/api/tasks/1/threads/11',
      expect.objectContaining({ content: '<p>Second</p>', temp_identifier: expect.any(String) }),
    )
    expect(wrapper.text()).toContain('Edited')
  })
})
