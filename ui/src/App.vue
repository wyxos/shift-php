<script lang="ts" setup>
import AuthErrorModal from './components/AuthErrorModal.vue';
import { ref } from 'vue';

const loginUrl = window.shiftConfig.loginRoute;
const appUrl = window.shiftConfig.baseUrl;
const appName = window.shiftConfig.appName;
const username = window.shiftConfig.username;

// For responsive sidebar toggle
const isSidebarOpen = ref(false);
</script>

<template>
    <div class="flex h-screen flex-col overflow-hidden bg-background">
        <!-- Header -->
        <header class="border-b border-border bg-card shadow-sm">
            <div class="container mx-auto flex h-16 items-center justify-between px-4">
                <div class="flex items-center gap-4">
                    <!-- Mobile menu button -->
                    <button
                        class="rounded-md p-2 text-muted-foreground hover:bg-accent/10 hover:text-accent-foreground md:hidden"
                        @click="isSidebarOpen = !isSidebarOpen"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                            <line x1="4" x2="20" y1="12" y2="12"></line>
                            <line x1="4" x2="20" y1="6" y2="6"></line>
                            <line x1="4" x2="20" y1="18" y2="18"></line>
                        </svg>
                        <span class="sr-only">Toggle menu</span>
                    </button>

                    <!-- App logo/name -->
                    <a :href="appUrl" class="flex items-center gap-2 text-xl font-bold text-primary">
                        {{ appName }}
                    </a>
                </div>

                <!-- User info -->
                <div class="flex items-center gap-4">
                    <div v-if="username" class="flex items-center gap-2">
                        <span class="hidden text-sm text-muted-foreground md:inline-block">Logged in as:</span>
                        <span class="text-sm font-semibold">{{ username }}</span>
                    </div>
                </div>
            </div>
        </header>

        <div class="flex flex-1 overflow-hidden">
            <!-- Sidebar (hidden on mobile unless toggled) -->
            <aside
                :class="[
                    'w-64 border-r border-border bg-card transition-all duration-300 ease-in-out',
                    isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
                ]"
                class="fixed inset-y-0 left-0 z-20 mt-16 h-[calc(100vh-4rem)] md:static md:mt-0 md:h-auto"
            >
                <div class="flex h-full flex-col p-4">
                    <nav class="space-y-1">
                        <router-link
                            :to="{ name: 'task-list' }"
                            class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10"
                            active-class="bg-primary/10 text-primary font-semibold"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                                <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"></path>
                                <path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"></path>
                                <path d="M12 3v6"></path>
                            </svg>
                            Tasks
                        </router-link>
                    </nav>
                </div>
            </aside>

            <!-- Main content -->
            <main class="flex-1 overflow-auto p-4">
                <div class="container mx-auto">
                    <router-view></router-view>
                </div>
            </main>
        </div>

        <!-- Backdrop for mobile sidebar -->
        <div
            v-if="isSidebarOpen"
            class="fixed inset-0 z-10 bg-black/50 md:hidden"
            @click="isSidebarOpen = false"
        ></div>

        <AuthErrorModal :redirect-url="loginUrl" />
    </div>
</template>
