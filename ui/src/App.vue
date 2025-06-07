<script lang="ts" setup>
import AuthErrorModal from './components/AuthErrorModal.vue';
import DashboardLayout from './components/DashboardLayout.vue';

const loginUrl = window.shiftConfig.loginRoute;
const appName = window.shiftConfig.appName;
const username = window.shiftConfig.username;
</script>
<template>
    <DashboardLayout :app-name="appName" :username="username">
        <router-view />
    </DashboardLayout>
    <AuthErrorModal :redirect-url="loginUrl" />
</template>
