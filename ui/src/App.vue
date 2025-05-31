<script lang="ts" setup>
import AuthErrorModal from './components/AuthErrorModal.vue';

const loginUrl = window.shiftConfig.loginRoute;

const appUrl = window.shiftConfig.baseUrl;

const appName = window.shiftConfig.appName;
</script>
<template>
    <div class="flex flex-col items-center overflow-hidden bg-blue-100 p-4 md:h-screen">
        <a :href="appUrl" class="p-4 font-bold hover:text-blue-500">{{ appName }}</a>
        <router-view></router-view>
        <AuthErrorModal :redirect-url="loginUrl" />
    </div>
</template>
