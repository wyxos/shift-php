import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import TaskListV2 from '../components/TaskListV2.vue'

const getMock = vi.fn()
const deleteMock = vi.fn()

vi.mock('@/axios-config', () => ({
  default: {
    get: (...args: any[]) => getMock(...args),
    delete: (...args: any[]) => deleteMock(...args),
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
  ShiftEditor: { template: '<div />' },
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
    getMock.mockReset()
    deleteMock.mockReset()
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
})
