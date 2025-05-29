<script lang="ts" setup>
import AuthErrorModal from './components/AuthErrorModal.vue';

const loginUrl = window.shiftConfig.loginRoute;

const appUrl = window.shiftConfig.baseUrl;

const appName = window.shiftConfig.appName;

</script>
<template>
    <a :href="appUrl" class="p-4 hover:text-blue-500 font-bold">{{ appName }}</a>
    <router-view></router-view>
    <AuthErrorModal :redirect-url="loginUrl" />
</template>
