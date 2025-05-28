<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

// State for the modal
const isVisible = ref(false);
const errorMessage = ref('Your session has expired or you are not authenticated.');

// Function to handle authentication errors
function handleAuthError(event: CustomEvent) {
    errorMessage.value = event.detail.message || 'Your session has expired or you are not authenticated.';
    isVisible.value = true;
}

// Function to close the modal
function closeModal() {
    isVisible.value = false;
}

// Function to redirect to the host app
function redirectToHostApp() {
    // Use the provided redirectUrl, or the configured login route, or default to the current origin
    window.location.href = window.shiftConfig.loginRoute;
}

// Add event listener when component is mounted
onMounted(() => {
    window.addEventListener('shift:auth-error', handleAuthError as EventListener);
});

// Remove event listener when component is unmounted
onUnmounted(() => {
    window.removeEventListener('shift:auth-error', handleAuthError as EventListener);
});
</script>

<template>
    <!-- Modal overlay -->
    <div v-if="isVisible" class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
        <!-- Modal content -->
        <div class="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div class="mb-4 flex items-center">
                <!-- Warning icon -->
                <svg class="mr-3 h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                </svg>
                <h3 class="text-lg font-medium text-gray-900">Authentication Required</h3>
            </div>

            <div class="mb-6">
                <p class="text-gray-700">{{ errorMessage }}</p>
            </div>

            <div class="flex justify-end space-x-3">
                <button @click="closeModal" class="rounded bg-gray-200 px-4 py-2 text-gray-800 transition-colors hover:bg-gray-300">Close</button>
                <button @click="redirectToHostApp" class="rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700">
                    Go to Login
                </button>
            </div>
        </div>
    </div>
</template>
