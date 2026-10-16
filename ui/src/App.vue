<script lang="ts" setup>
import 'vue-sonner/style.css';
import { Toaster } from 'vue-sonner';
import AppContent from '@shift/components/AppContent.vue';
import AppSidebarHeader from '@shift/components/AppSidebarHeader.vue';
import AuthErrorModal from './components/AuthErrorModal.vue';
import ShiftShell from './components/ShiftShell.vue';
import ShiftSidebar from './components/ShiftSidebar.vue';
import InboxNotifications from './components/InboxNotifications.vue';
import ShiftAccountMenu from './components/ShiftAccountMenu.vue';
import { ArrowLeft } from 'lucide-vue-next';

const appName = window.shiftConfig.appName?.trim() || 'application';
const appUrl = window.shiftConfig.baseUrl;
const username = window.shiftConfig.username;

const loginUrl = window.shiftConfig.loginRoute;
</script>

<template>
    <ShiftShell variant="sidebar">
        <ShiftSidebar />
        <AppContent variant="sidebar">
            <AppSidebarHeader show-appearance-toggle :show-notifications="false">
                <template #navigation>
                    <a :href="appUrl" class="text-primary hover:bg-accent focus-visible:ring-ring flex min-w-0 items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none" :aria-label="`Back to ${appName}`">
                        <ArrowLeft class="size-4 shrink-0" aria-hidden="true" />
                        <span class="truncate">Back to {{ appName }}</span>
                    </a>
                </template>
                <template #actions>
                    <InboxNotifications />
                    <div v-if="username" class="md:hidden">
                        <ShiftAccountMenu compact />
                    </div>
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
