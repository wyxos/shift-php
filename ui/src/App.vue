<script lang="ts" setup>
import 'vue-sonner/style.css';
import { Toaster } from 'vue-sonner';
import AppContent from '@shift/components/AppContent.vue';
import AppearanceTabs from '@shift/components/AppearanceTabs.vue';
import AppSidebarHeader from '@shift/components/AppSidebarHeader.vue';
import AuthErrorModal from './components/AuthErrorModal.vue';
import ShiftShell from './components/ShiftShell.vue';
import ShiftSidebar from './components/ShiftSidebar.vue';

const loginUrl = window.shiftConfig.loginRoute;
</script>

<template>
    <ShiftShell variant="sidebar">
        <ShiftSidebar />
        <AppContent variant="sidebar">
            <AppSidebarHeader>
                <template #actions>
                    <AppearanceTabs compact />
                </template>
            </AppSidebarHeader>
            <div class="flex h-full flex-1 flex-col gap-4 p-4">
                <router-view></router-view>
            </div>
        </AppContent>
    </ShiftShell>

    <AuthErrorModal :redirect-url="loginUrl" />

    <Toaster rich-colors />
</template>
