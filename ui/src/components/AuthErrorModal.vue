<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { AlertTriangle } from 'lucide-vue-next';
import { Button } from '@shift/ui/button';

const isVisible = ref(false);
const errorMessage = ref('Your session has expired or you are not authenticated.');

function handleAuthError(event: CustomEvent) {
    errorMessage.value = event.detail.message || 'Your session has expired or you are not authenticated.';
    isVisible.value = true;
}

function closeModal() {
    isVisible.value = false;
}

function redirectToHostApp() {
    window.location.href = window.shiftConfig?.loginRoute ?? '/login';
}

onMounted(() => {
    window.addEventListener('shift:auth-error', handleAuthError as EventListener);
});

onUnmounted(() => {
    window.removeEventListener('shift:auth-error', handleAuthError as EventListener);
});
</script>

<template>
    <div v-if="isVisible" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
        <div class="border-border/70 bg-background/95 w-full max-w-md rounded-2xl border p-6 shadow-2xl">
            <div class="mb-6 flex items-start gap-4">
                <div class="bg-primary/12 text-primary ring-primary/20 flex size-11 shrink-0 items-center justify-center rounded-2xl ring-1">
                    <AlertTriangle class="size-5" />
                </div>
                <div class="space-y-1">
                    <h3 class="text-lg font-semibold">Authentication Required</h3>
                    <p class="text-muted-foreground text-sm leading-6">{{ errorMessage }}</p>
                </div>
            </div>

            <div class="flex justify-end gap-2">
                <Button variant="outline" @click="closeModal">Dismiss</Button>
                <Button @click="redirectToHostApp">Go to Login</Button>
            </div>
        </div>
    </div>
</template>
