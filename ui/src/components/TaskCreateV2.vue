<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/axios-config'
import { toast } from 'vue-sonner'
import { Plus } from 'lucide-vue-next'
import { Button } from '@shift/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@shift/ui/card'
import { Input } from '@shift/ui/input'
import { Label } from '@shift/ui/label'
import Select from './ui/select.vue'
import FormItem from './ui/form-item.vue'
import ShiftEditor from '@shared/components/ShiftEditor.vue'

const uploadEndpoints = {
  init: '/shift/api/attachments/upload-init',
  status: '/shift/api/attachments/upload-status',
  chunk: '/shift/api/attachments/upload-chunk',
  complete: '/shift/api/attachments/upload-complete',
}

const removeTempUrl = '/shift/api/attachments/remove-temp'

function resolveTempUrl(data: any): string {
  if (data && data.url) return data.url as string
  if (data && data.path) {
    const match = String(data.path).match(/^temp_attachments\/([^/]+)\/(.+)$/)
    if (match) {
      return `/shift/api/attachments/temp/${match[1]}/${match[2]}`
    }
  }
  return ''
}

const router = useRouter()
const createError = ref<string | null>(null)
const loading = ref(false)
const tempIdentifier = ref(Date.now().toString())
const isEditorUploading = ref(false)

const newTask = ref({
  title: '',
  description: '',
  priority: 'medium',
})

const isSubmitDisabled = computed(() => loading.value || isEditorUploading.value)

async function createTask() {
  createError.value = null
  loading.value = true

  try {
    const source_url = window.location.origin
    const environment = import.meta.env.VITE_APP_ENV || 'production'

    const payload = {
      title: newTask.value.title,
      description: newTask.value.description,
      priority: newTask.value.priority,
      source_url,
      environment,
      temp_identifier: tempIdentifier.value,
    }

    await axios.post('/shift/api/tasks', payload)
    toast.success('Task created', { description: 'Your task has been added to the queue.' })
    await router.push({ name: 'task-list-v2' })
  } catch (e: any) {
    createError.value = e.response?.data?.error || e.response?.data?.message || e.message || 'Unknown error'
  } finally {
    loading.value = false
  }
}

function cancel() {
  router.push({ name: 'task-list-v2' })
}
</script>

<template>
  <Card class="w-full">
    <CardHeader>
      <div>
        <CardTitle>Create Task</CardTitle>
        <p class="text-sm text-muted-foreground">Add a new task to your project queue.</p>
      </div>
    </CardHeader>

    <CardContent>
      <form class="space-y-6" @submit.prevent="createTask">
        <FormItem>
          <Label>Title</Label>
          <Input v-model="newTask.title" placeholder="Short, descriptive title" required />
        </FormItem>

        <FormItem>
          <Label>Priority</Label>
          <Select v-model="newTask.priority">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
        </FormItem>

        <FormItem>
          <Label>Description</Label>
          <ShiftEditor
            v-model="newTask.description"
            :temp-identifier="tempIdentifier"
            :min-height="180"
            :axios-instance="axios"
            :upload-endpoints="uploadEndpoints"
            :remove-temp-url="removeTempUrl"
            :resolve-temp-url="resolveTempUrl"
            placeholder="Write the full task details, then drag files into the editor."
            @uploading="isEditorUploading = $event"
          />
        </FormItem>

        <div v-if="createError" class="text-sm text-red-600">
          {{ createError }}
        </div>

        <CardFooter class="flex justify-end gap-2 p-0 pt-2">
          <Button variant="outline" type="button" @click="cancel">Cancel</Button>
          <Button :disabled="isSubmitDisabled" variant="default" type="submit">
            <Plus class="mr-2 h-4 w-4" />
            {{ loading ? 'Creating...' : 'Create' }}
          </Button>
        </CardFooter>
      </form>
    </CardContent>
  </Card>
</template>
