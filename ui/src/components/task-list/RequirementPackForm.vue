<script lang="ts" setup>
import { Button } from '@shift/ui/button';
import { Input } from '@shift/ui/input';
import { Label } from '@shift/ui/label';
import { Plus, Trash2 } from 'lucide-vue-next';
import { computed, ref } from 'vue';

type RequirementDraft = {
    key: number;
    title: string;
    description: string;
};

type RequirementPackPayload = {
    title: string;
    items: Array<{
        title: string;
        description: string;
    }>;
};

defineProps<{
    loading: boolean;
    error: string | null;
}>();

const emit = defineEmits<{
    submit: [payload: RequirementPackPayload];
    cancel: [];
}>();

const packTitle = ref('');
const nextKey = ref(2);
const items = ref<RequirementDraft[]>([
    {
        key: 1,
        title: '',
        description: '',
    },
]);

const validItems = computed(() =>
    items.value
        .map((item) => ({
            title: item.title.trim(),
            description: item.description.trim(),
        }))
        .filter((item) => item.title.length > 0 && item.description.length > 0),
);

const canSubmit = computed(() => validItems.value.length > 0);

function addItem() {
    items.value = [
        ...items.value,
        {
            key: nextKey.value,
            title: '',
            description: '',
        },
    ];
    nextKey.value += 1;
}

function removeItem(key: number) {
    if (items.value.length === 1) return;
    items.value = items.value.filter((item) => item.key !== key);
}

function submit() {
    if (!canSubmit.value) return;
    emit('submit', {
        title: packTitle.value.trim(),
        items: validItems.value,
    });
}
</script>

<template>
    <form
        class="border-muted-foreground/20 bg-muted/10 mb-4 space-y-4 rounded-md border p-4"
        data-testid="requirement-pack-form"
        @submit.prevent="submit"
    >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="space-y-1">
                <h2 class="text-sm font-semibold">New requirement pack</h2>
            </div>
            <div class="flex items-center gap-2">
                <Button type="button" variant="outline" @click="emit('cancel')">Cancel</Button>
                <Button data-testid="submit-requirement-pack" type="submit" :disabled="loading || !canSubmit">
                    {{ loading ? 'Submitting...' : 'Submit Pack' }}
                </Button>
            </div>
        </div>

        <div class="space-y-2">
            <Label class="text-muted-foreground">Pack name</Label>
            <Input v-model="packTitle" data-testid="requirement-pack-title" placeholder="Optional grouping name" />
        </div>

        <div class="space-y-3">
            <div
                v-for="(item, index) in items"
                :key="item.key"
                class="border-muted-foreground/20 bg-background grid gap-3 rounded-md border p-3"
            >
                <div class="flex items-center justify-between gap-3">
                    <Label class="text-muted-foreground">Requirement {{ index + 1 }}</Label>
                    <Button
                        v-if="items.length > 1"
                        type="button"
                        size="icon"
                        variant="ghost"
                        :data-testid="`remove-requirement-item-${index}`"
                        @click="removeItem(item.key)"
                    >
                        <Trash2 class="h-4 w-4" />
                    </Button>
                </div>
                <Input
                    v-model="item.title"
                    :data-testid="`requirement-item-title-${index}`"
                    placeholder="Short requirement title"
                    required
                />
                <textarea
                    v-model="item.description"
                    :data-testid="`requirement-item-description-${index}`"
                    class="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-24 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                    placeholder="Describe what you need, questions, examples, or constraints."
                    required
                ></textarea>
            </div>
        </div>

        <div class="flex items-center justify-between gap-3">
            <div v-if="error" class="text-destructive text-sm">{{ error }}</div>
            <div v-else></div>
            <Button data-testid="add-requirement-item" type="button" variant="outline" @click="addItem">
                <Plus class="mr-2 h-4 w-4" />
                Add Requirement
            </Button>
        </div>
    </form>
</template>
