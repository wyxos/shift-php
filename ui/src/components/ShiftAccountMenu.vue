<script setup lang="ts">
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@shift/ui/alert-dialog';
import { Button } from '@shift/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@shift/ui/dropdown-menu';
import { ChevronsUpDown, LogOut } from 'lucide-vue-next';
import { ref } from 'vue';

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false });

const config = window.shiftConfig;
const appName = config.appName?.trim() || 'application';
const username = config.username || 'Your account';
const confirmOpen = ref(false);
const submitting = ref(false);
const trigger = ref<HTMLButtonElement | null>(null);
const logoutForm = ref<HTMLFormElement | null>(null);

function logoutAction() {
    if (!config.logoutRoute || !config.csrfToken || !config.logoutMethod || !['POST', 'DELETE', 'PUT', 'PATCH'].includes(config.logoutMethod)) return null;
    try {
        const url = new URL(config.logoutRoute, window.location.href);
        return url.origin === window.location.origin ? { url: url.href, method: config.logoutMethod, token: config.csrfToken } : null;
    } catch {
        return null;
    }
}

const logout = logoutAction();

function submitLogout() {
    if (!logout || submitting.value || !logoutForm.value) return;
    submitting.value = true;
    logoutForm.value.requestSubmit();
}

function restoreFocus(event: Event) {
    event.preventDefault();
    trigger.value?.focus();
}
</script>

<template>
    <DropdownMenu>
        <DropdownMenuTrigger as-child>
            <Button variant="ghost" :size="compact ? 'icon' : 'default'" :class="compact ? 'size-9' : 'h-auto w-full justify-start gap-2 p-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0'" as-child>
                <button ref="trigger" type="button" aria-label="Open account menu">
                    <span class="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold">{{ username.charAt(0).toUpperCase() }}</span>
                    <span v-if="!compact" class="grid min-w-0 flex-1 text-left text-sm group-data-[collapsible=icon]:hidden">
                        <span class="truncate font-medium">{{ username }}</span>
                        <span v-if="config.email" class="text-muted-foreground truncate text-xs">{{ config.email }}</span>
                    </span>
                    <ChevronsUpDown v-if="!compact" class="ml-auto size-4 shrink-0 group-data-[collapsible=icon]:hidden" aria-hidden="true" />
                </button>
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent :side="compact ? 'bottom' : 'top'" align="end" :side-offset="8" class="w-64 max-w-[calc(100vw-2rem)]" @close-auto-focus="confirmOpen && $event.preventDefault()">
            <DropdownMenuLabel class="space-y-1 font-normal">
                <span class="block truncate font-medium">{{ username }}</span>
                <span v-if="config.email" class="text-muted-foreground block truncate text-xs">{{ config.email }}</span>
                <span class="text-muted-foreground block text-xs break-words">{{ appName }}<template v-if="config.appEnvironment"> · {{ config.appEnvironment }}</template></span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem v-if="logout" class="text-destructive focus:text-destructive" @select="confirmOpen = true">
                <LogOut class="size-4 shrink-0" aria-hidden="true" />
                <span class="whitespace-normal break-words">Sign out of {{ appName }}</span>
            </DropdownMenuItem>
            <p v-else class="text-muted-foreground px-2 py-1.5 text-xs">Return to {{ appName }} to sign out.</p>
        </DropdownMenuContent>
    </DropdownMenu>

    <AlertDialog v-if="logout" v-model:open="confirmOpen">
        <AlertDialogContent @close-auto-focus="restoreFocus">
            <AlertDialogHeader>
                <AlertDialogTitle class="break-words">Sign out of {{ appName }}?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will end your {{ appName }} session<template v-if="config.appEnvironment"> in {{ config.appEnvironment }}</template>. Your linked accounts and tickets will stay unchanged.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel :disabled="submitting">Cancel</AlertDialogCancel>
                <AlertDialogAction :disabled="submitting" @click.prevent="submitLogout">{{ submitting ? 'Signing out…' : 'Sign out' }}</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    <form v-if="logout" ref="logoutForm" :action="logout.url" method="post" hidden>
        <input type="hidden" name="_token" :value="logout.token" />
        <input v-if="logout.method !== 'POST'" type="hidden" name="_method" :value="logout.method" />
    </form>
</template>
