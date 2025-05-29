<script lang="ts" setup>
import AuthErrorModal from './components/AuthErrorModal.vue';

const shiftUrl = window.shiftConfig?.loginRoute?.split('/login')[0] || window.location.origin;

const appUrl = window.shiftConfig?.baseUrl || window.location.origin;

const appName = window.shiftConfig?.appName || 'Shift';

</script>
<template>
    <a :href="appUrl" class="p-4 hover:text-blue-500 font-bold">{{ appName }}</a>
    <router-view></router-view>
    <AuthErrorModal :redirect-url="shiftUrl" />
</template>
