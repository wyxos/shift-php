<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

// Props for the component
const props = defineProps<{
  // Allow customizing the redirect URL
  redirectUrl?: string;
}>();

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
  const url = props.redirectUrl ||
    (window.shiftConfig && window.shiftConfig.loginRoute) ||
    window.location.origin;
  window.location.href = url;
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
  <div v-if="isVisible" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <!-- Modal content -->
    <div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
      <div class="flex items-center mb-4">
        <!-- Warning icon -->
        <svg class="h-6 w-6 text-amber-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3 class="text-lg font-medium text-gray-900">Authentication Required</h3>
      </div>

      <div class="mb-6">
        <p class="text-gray-700">{{ errorMessage }}</p>
      </div>

      <div class="flex justify-end space-x-3">
        <button
          @click="closeModal"
          class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
        >
          Close
        </button>
        <button
          @click="redirectToHostApp"
          class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Go to Login
        </button>
      </div>
    </div>
  </div>
</template>
