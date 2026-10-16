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
import axios from '@/axios-config';
import { useRoute } from 'vue-router';
import { computed, onMounted, ref } from 'vue';
import { Home, Inbox, Settings } from 'lucide-vue-next';
import AppLogo from '@shift/components/AppLogo.vue';
import ShiftAccountMenu from './ShiftAccountMenu.vue';

const appUrl = window.shiftConfig.baseUrl;
const username = window.shiftConfig.username;
const appName = window.shiftConfig.appName?.trim() || 'application';
const route = useRoute();
const canManageExternalRoles = ref(false);

const baseNavItems = [
    {
        title: 'Dashboard',
        href: '/dashboard',
        icon: Home,
    },
    {
        title: 'Tasks',
        href: '/tasks',
        icon: Inbox,
    },
];

const mainNavItems = computed(() => [
    ...baseNavItems,
    ...(canManageExternalRoles.value
        ? [
              {
                  title: 'Settings',
                  href: '/settings',
                  icon: Settings,
              },
          ]
        : []),
]);

onMounted(async () => {
    try {
        const response = await axios.get('/shift/api/external-roles/capabilities');
        canManageExternalRoles.value = response.data?.capabilities?.can_manage_external_roles === true;
    } catch {
        canManageExternalRoles.value = false;
    }
});
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
            <p v-if="username" class="text-muted-foreground truncate px-2 text-xs group-data-[collapsible=icon]:hidden">Signed in through {{ appName }}</p>
            <SidebarMenu>
                <SidebarMenuItem v-if="username">
                    <ShiftAccountMenu />
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarFooter>
    </Sidebar>
    <slot />
</template>
