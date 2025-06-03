<script lang="ts" setup>
import AuthErrorModal from './components/AuthErrorModal.vue';

const loginUrl = window.shiftConfig.loginRoute;
const appUrl = window.shiftConfig.baseUrl;
const appName = window.shiftConfig.appName;
const username = window.shiftConfig.username;
</script>
<template>
    <div class="flex flex-col items-center overflow-hidden bg-blue-100 p-4 md:h-screen">
        <div class="w-full flex justify-between items-center px-4">
            <a :href="appUrl" class="p-4 font-bold hover:text-blue-500">{{ appName }}</a>
            <div v-if="username" class="text-sm text-gray-600">
                Logged in as: <span class="font-semibold">{{ username }}</span>
            </div>
        </div>
        <router-view></router-view>
        <AuthErrorModal :redirect-url="loginUrl" />
    </div>
</template>
