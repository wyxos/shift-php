<script setup lang="ts">
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@shift/ui/sidebar';
import { useRoute } from 'vue-router';
import { Inbox, ListChecks } from 'lucide-vue-next';
import AppLogo from '@shift/components/AppLogo.vue';

const appUrl = window.shiftConfig.baseUrl;
const username = window.shiftConfig.username;
const userEmail = window.shiftConfig.email;
const route = useRoute();

const mainNavItems = [
    {
        title: 'Tasks',
        href: '/',
        icon: Inbox,
    },
    {
        title: 'Tasks V2',
        href: '/tasks-v2',
        icon: ListChecks,
    },
];
</script>

<template>
    <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton size="lg" as-child>
                        <a :href="appUrl">
                            <AppLogo />
                        </a>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
            <SidebarGroup class="px-2 py-0">
                <SidebarGroupLabel>Platform</SidebarGroupLabel>
                <SidebarMenu>
                    <SidebarMenuItem v-for="item in mainNavItems" :key="item.title">
                        <SidebarMenuButton as-child :is-active="route.path === item.href" :tooltip="item.title">
                            <router-link :to="item.href">
                                <component :is="item.icon" />
                                <span>{{ item.title }}</span>
                            </router-link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
            <SidebarMenu>
                <SidebarMenuItem v-if="username">
                    <SidebarMenuButton size="lg" class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                        <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                            <span class="text-xs font-semibold">{{ username.charAt(0).toUpperCase() }}</span>
                        </div>
                        <div class="grid flex-1 text-left text-sm leading-tight">
                            <span class="truncate font-medium">{{ username }}</span>
                            <span v-if="userEmail" class="truncate text-xs text-muted-foreground">{{ userEmail }}</span>
                        </div>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarFooter>
    </Sidebar>
    <slot />
</template>
