<script setup lang="ts">
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarGroup, SidebarGroupLabel } from '@shift/ui/sidebar';
import { useRoute } from 'vue-router';
import { Inbox } from 'lucide-vue-next';
import AppLogo from '@shift/components/AppLogo.vue';

const appUrl = window.shiftConfig.baseUrl;
const username = window.shiftConfig.username;
const route = useRoute();

const mainNavItems = [
    {
        title: 'Tasks',
        href: '/',
        icon: Inbox,
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
                        <SidebarMenuButton 
                            as-child 
                            :is-active="route.path === item.href"
                            :tooltip="item.title"
                        >
                            <router-link :to="item.href">
                                <component :is="item.icon" />
                                <span>{{ item.title }}</span>
                            </router-link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarGroup>
        </SidebarContent>

        <SidebarFooter v-if="username">
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton size="lg" class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                        <div class="flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                            <span class="text-xs font-semibold">{{ username.charAt(0).toUpperCase() }}</span>
                        </div>
                        <div class="grid flex-1 text-left text-sm leading-tight">
                            <span class="truncate font-semibold">{{ username }}</span>
                        </div>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarFooter>
    </Sidebar>
    <slot />
</template>
