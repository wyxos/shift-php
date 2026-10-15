<script lang="ts" setup>
import 'vue-sonner/style.css';
import { Toaster } from 'vue-sonner';
import AppContent from '@shift/components/AppContent.vue';
import AppSidebarHeader from '@shift/components/AppSidebarHeader.vue';
import AuthErrorModal from './components/AuthErrorModal.vue';
import ShiftShell from './components/ShiftShell.vue';
import ShiftSidebar from './components/ShiftSidebar.vue';
import InboxNotifications from './components/InboxNotifications.vue';

const loginUrl = window.shiftConfig.loginRoute;
</script>

<template>
    <ShiftShell variant="sidebar">
        <ShiftSidebar />
        <AppContent variant="sidebar">
            <AppSidebarHeader show-appearance-toggle :show-notifications="false">
                <template #actions>
                    <InboxNotifications />
                </template>
            </AppSidebarHeader>
            <div class="flex h-full flex-1 flex-col gap-4 p-4">
                <router-view></router-view>
            </div>
        </AppContent>
    </ShiftShell>

    <AuthErrorModal :redirect-url="loginUrl" />

    <Toaster rich-colors position="bottom-center" />
</template>
