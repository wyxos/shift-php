<script lang="ts" setup>
import AuthErrorModal from './components/AuthErrorModal.vue';

// Get the SHIFT URL from the global variable injected by the backend
// TypeScript declaration for the global SHIFT_URL variable
declare global {
  interface Window {
    SHIFT_URL: string;
  }
}

const shiftUrl = window.SHIFT_URL || window.location.origin;
</script>
<template>
    <router-view></router-view>
    <AuthErrorModal :redirect-url="shiftUrl" />
</template>
