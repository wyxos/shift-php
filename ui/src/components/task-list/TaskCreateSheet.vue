<script lang="ts" setup>
import axios from '@/axios-config';
import TaskCollaboratorField from '@shared/components/TaskCollaboratorField.vue';
import TaskCreateForm from '@shared/components/TaskCreateForm.vue';
import { type TaskCollaboratorSelection } from '@shared/tasks/collaborators';
import { Button } from '@shift/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@shift/ui/sheet';
import { AlertCircle, CheckCircle2, LoaderCircle, Mail, Plus, UploadCloud } from 'lucide-vue-next';
import { ref, watch } from 'vue';
import { toast } from 'vue-sonner';
import { aiImproveUrl, getTaskListAiImproveEnabled, removeTempUrl, resolveTempUrl, taskListUploadEndpoints } from './editor-config';

interface CreateFormModel {
    title: string;
    priority: string;
    description: string;
    collaborators: TaskCollaboratorSelection;
}

interface Props {
    open: boolean;
    form: CreateFormModel;
    tempIdentifier: string;
    loading: boolean;
    uploading: boolean;
    error: string | null;
    setOpen: (value: boolean) => void;
    updateForm: (value: { title: string; priority: string; description: string }) => void;
    updateCollaborators: (value: TaskCollaboratorSelection) => void;
    setUploading: (value: boolean) => void;
    submit: () => void | Promise<void>;
}

type TaskEmailImportResult = {
    title?: string;
    priority?: string;
    description_html?: string;
    missing_details?: string[];
    source?: {
        subject?: string;
        from?: string;
        attachments?: string[];
    };
    ai_used?: boolean;
    ai_error?: string | null;
};

const props = defineProps<Props>();

const aiImproveEnabled = getTaskListAiImproveEnabled();
const emailImportInput = ref<HTMLInputElement | null>(null);
const emailImportLoading = ref(false);
const emailImportDragging = ref(false);
const emailImportError = ref<string | null>(null);
const emailImportResult = ref<TaskEmailImportResult | null>(null);

watch(
    () => props.open,
    (open) => {
        if (open) {
            resetEmailImportState();
        }
    },
);

function resetEmailImportState() {
    emailImportLoading.value = false;
    emailImportDragging.value = false;
    emailImportError.value = null;
    emailImportResult.value = null;

    if (emailImportInput.value) {
        emailImportInput.value.value = '';
    }
}

function openEmailImportFilePicker() {
    if (!aiImproveEnabled || emailImportLoading.value) {
        return;
    }

    emailImportInput.value?.click();
}

function handleEmailImportInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = firstImportFile(input.files);

    void importEmailFile(file);

    input.value = '';
}

function handleEmailImportDrop(event: DragEvent) {
    emailImportDragging.value = false;
    void importEmailFile(firstImportFile(event.dataTransfer?.files));
}

function firstImportFile(files: FileList | File[] | null | undefined): File | null {
    if (!files || files.length < 1) {
        return null;
    }

    return 'item' in files && typeof files.item === 'function' ? files.item(0) : (files[0] ?? null);
}

function isEmlFile(file: File): boolean {
    return file.name.toLowerCase().endsWith('.eml') || file.type === 'message/rfc822';
}

function applyEmailImportResult(result: TaskEmailImportResult) {
    const title = typeof result.title === 'string' ? result.title.trim() : '';
    const priority = typeof result.priority === 'string' ? result.priority.toLowerCase() : '';
    const description = typeof result.description_html === 'string' ? result.description_html.trim() : '';

    props.updateForm({
        title: title !== '' ? title : props.form.title,
        priority: ['low', 'medium', 'high'].includes(priority) ? priority : props.form.priority,
        description: description !== '' ? description : props.form.description,
    });
}

async function importEmailFile(file: File | null) {
    if (!aiImproveEnabled) {
        return;
    }

    if (!file) {
        return;
    }

    if (!isEmlFile(file)) {
        emailImportError.value = 'Use an .eml email file.';
        return;
    }

    emailImportLoading.value = true;
    emailImportError.value = null;
    emailImportResult.value = null;

    try {
        const formData = new FormData();

        formData.append('email', file);

        const response = await axios.post('/shift/api/tasks/email-import', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        const result = (response.data?.data ?? response.data ?? {}) as TaskEmailImportResult;

        applyEmailImportResult(result);
        emailImportResult.value = result;

        if (result.ai_error) {
            emailImportError.value = result.ai_error;
        }

        toast.success('Email imported', { description: 'Review the draft before creating it.' });
    } catch (error: any) {
        emailImportError.value =
            error.response?.data?.errors?.email?.[0] ||
            error.response?.data?.message ||
            error.response?.data?.error ||
            error.message ||
            'The email could not be imported.';
    } finally {
        emailImportLoading.value = false;
    }
}
</script>

<template>
    <Sheet :open="open" @update:open="setOpen">
        <SheetContent class="flex h-full flex-col p-0" side="right" width-preset="task">
            <SheetHeader class="p-0">
                <div class="px-6 pt-6 pb-3">
                    <SheetTitle>Create Task</SheetTitle>
                    <SheetDescription class="text-muted-foreground mt-1 text-sm"> Add a new task to your project queue. </SheetDescription>
                </div>
            </SheetHeader>

            <div v-if="aiImproveEnabled" class="border-border/70 px-6 pb-4">
                <div
                    data-testid="task-email-import-dropzone"
                    role="button"
                    tabindex="0"
                    :aria-busy="emailImportLoading"
                    class="border-border bg-muted/20 hover:bg-muted/35 focus-visible:ring-ring flex min-h-24 cursor-pointer items-center justify-between gap-4 rounded-md border border-dashed px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    :class="{
                        'border-primary bg-primary/5': emailImportDragging,
                        'cursor-wait opacity-75': emailImportLoading,
                    }"
                    @click="openEmailImportFilePicker"
                    @keydown.enter.prevent="openEmailImportFilePicker"
                    @keydown.space.prevent="openEmailImportFilePicker"
                    @dragenter.prevent="emailImportDragging = true"
                    @dragover.prevent="emailImportDragging = true"
                    @dragleave.prevent="emailImportDragging = false"
                    @drop.prevent="handleEmailImportDrop"
                >
                    <input
                        ref="emailImportInput"
                        data-testid="task-email-import-input"
                        class="hidden"
                        type="file"
                        accept=".eml,message/rfc822"
                        @change="handleEmailImportInput"
                    />
                    <div class="flex min-w-0 items-center gap-3">
                        <span class="bg-background text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md border">
                            <Mail class="h-5 w-5" />
                        </span>
                        <div class="min-w-0">
                            <p class="text-sm font-medium">Import email</p>
                            <p class="text-muted-foreground truncate text-xs">Drop an .eml file or browse.</p>
                        </div>
                    </div>
                    <Button type="button" size="sm" variant="outline" :disabled="emailImportLoading" @click.stop="openEmailImportFilePicker">
                        <LoaderCircle v-if="emailImportLoading" class="mr-2 h-4 w-4 animate-spin" />
                        <UploadCloud v-else class="mr-2 h-4 w-4" />
                        {{ emailImportLoading ? 'Importing...' : 'Browse' }}
                    </Button>
                </div>

                <p v-if="emailImportError" class="text-destructive mt-2 flex items-center gap-2 text-xs">
                    <AlertCircle class="h-3.5 w-3.5" />
                    <span>{{ emailImportError }}</span>
                </p>
                <p v-else-if="emailImportResult" class="mt-2 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 class="h-3.5 w-3.5" />
                    <span>Email draft imported.</span>
                </p>
            </div>

            <TaskCreateForm
                class="min-h-0 flex-1"
                :model-value="form"
                :temp-identifier="tempIdentifier"
                :axios-instance="axios"
                :enable-ai-improve="aiImproveEnabled"
                :ai-improve-url="aiImproveUrl"
                :remove-temp-url="removeTempUrl"
                :resolve-temp-url="resolveTempUrl"
                :upload-endpoints="taskListUploadEndpoints"
                :error="error"
                @submit="submit"
                @update:modelValue="updateForm"
                @update:uploading="setUploading"
            >
                <TaskCollaboratorField
                    :model-value="form.collaborators"
                    lookup-url="/shift/api/task-collaborators"
                    internal-label="Organisation"
                    internal-description="Users with access in SHIFT."
                    external-label="Team"
                    :external-badge-label="null"
                    external-description="Users with access from this portal."
                    @update:model-value="updateCollaborators"
                />
                <p class="text-muted-foreground text-xs">On create, the submitter and selected collaborators are notified.</p>

                <template #actions>
                    <SheetFooter class="flex flex-row items-center justify-between border-t px-6 py-4">
                        <Button type="button" variant="outline" @click="setOpen(false)">Cancel</Button>
                        <Button data-testid="submit-create-task" :disabled="loading || uploading" type="submit" variant="default">
                            <Plus class="mr-2 h-4 w-4" />
                            {{ loading ? 'Creating...' : 'Create' }}
                        </Button>
                    </SheetFooter>
                </template>
            </TaskCreateForm>
        </SheetContent>
    </Sheet>
</template>
