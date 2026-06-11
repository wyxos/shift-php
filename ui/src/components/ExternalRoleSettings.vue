<script setup lang="ts">
import axios from '@/axios-config';
import { Badge } from '@shift/ui/badge';
import { Button } from '@shift/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shift/ui/card';
import { Check, RefreshCw, Shield } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { toast } from 'vue-sonner';

type ExternalRole = 'owner' | 'client_developer' | 'shift_lead_developer' | 'shift_developer' | 'user' | 'guest';

interface RoleOption {
    value: string;
    label: string;
}

interface ExternalUserRole {
    id: string | number;
    name: string;
    email: string;
    role?: ExternalRole | string | null;
    environment?: string | null;
}

interface ExternalRoleResponse {
    capabilities?: {
        can_manage_external_roles?: boolean;
    };
    roles?: Array<string | Partial<RoleOption>>;
    users?: ExternalUserRole[];
}

const fallbackRoles: ExternalRole[] = [
    'owner',
    'client_developer',
    'shift_lead_developer',
    'shift_developer',
    'user',
    'guest',
];

const loading = ref(true);
const error = ref<string | null>(null);
const canManageExternalRoles = ref(false);
const roles = ref<RoleOption[]>(fallbackRoles.map((role) => normalizeRoleOption(role)));
const users = ref<ExternalUserRole[]>([]);
const roleDrafts = ref<Record<string, string>>({});
const savingUserId = ref<string | null>(null);

const visibleUsers = computed(() => (canManageExternalRoles.value ? users.value : []));

onMounted(() => {
    void fetchExternalRoles();
});

async function fetchExternalRoles() {
    loading.value = true;
    error.value = null;

    try {
        const response = await axios.get('/shift/api/external-roles');
        const payload = response.data as ExternalRoleResponse;

        canManageExternalRoles.value = payload.capabilities?.can_manage_external_roles === true;
        roles.value = payload.roles?.length
            ? payload.roles.map((role) => normalizeRoleOption(role))
            : fallbackRoles.map((role) => normalizeRoleOption(role));
        users.value = Array.isArray(payload.users) ? payload.users : [];
        roleDrafts.value = Object.fromEntries(
            users.value.map((user) => [userKey(user), String(user.role || 'guest')]),
        );
    } catch (exception: any) {
        error.value = exception?.response?.data?.error || exception?.response?.data?.message || 'Unable to load external roles.';
        canManageExternalRoles.value = false;
        users.value = [];
    } finally {
        loading.value = false;
    }
}

async function saveRole(user: ExternalUserRole) {
    const key = userKey(user);
    const role = roleDrafts.value[key] || 'guest';

    savingUserId.value = key;

    try {
        const response = await axios.put('/shift/api/external-roles', {
            environment: user.environment || window.shiftConfig.appEnvironment,
            role,
            external_user: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
        });

        const updatedRole = response.data?.user?.role || role;
        users.value = users.value.map((candidate) => (
            userKey(candidate) === key ? { ...candidate, role: updatedRole } : candidate
        ));
        roleDrafts.value[key] = updatedRole;
        toast.success('External role updated.');
    } catch (exception: any) {
        toast.error(exception?.response?.data?.error || exception?.response?.data?.message || 'Unable to update external role.');
    } finally {
        savingUserId.value = null;
    }
}

function userKey(user: ExternalUserRole): string {
    return String(user.id);
}

function roleLabel(role: string | null | undefined): string {
    return String(role || 'guest')
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function normalizeRoleOption(role: string | Partial<RoleOption>): RoleOption {
    if (typeof role === 'string') {
        return {
            value: role,
            label: roleLabel(role),
        };
    }

    const value = String(role.value || 'guest');

    return {
        value,
        label: role.label || roleLabel(value),
    };
}

function hasChanged(user: ExternalUserRole): boolean {
    return (roleDrafts.value[userKey(user)] || 'guest') !== String(user.role || 'guest');
}
</script>

<template>
    <div class="flex h-full flex-1 flex-col gap-4" data-testid="external-role-settings">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
                <p class="text-muted-foreground text-sm">External access for this SHIFT project.</p>
            </div>
            <Button variant="outline" :disabled="loading" @click="fetchExternalRoles">
                <RefreshCw />
                Refresh
            </Button>
        </div>

        <div v-if="loading" class="text-muted-foreground py-10 text-sm" data-testid="external-role-loading">Loading settings...</div>

        <Card v-else-if="error" class="border-destructive/40" data-testid="external-role-error">
            <CardHeader>
                <CardTitle>Settings unavailable</CardTitle>
                <CardDescription>{{ error }}</CardDescription>
            </CardHeader>
            <CardContent>
                <Button @click="fetchExternalRoles">Retry</Button>
            </CardContent>
        </Card>

        <Card v-else-if="!canManageExternalRoles" data-testid="external-role-denied">
            <CardHeader>
                <CardTitle>Settings unavailable</CardTitle>
                <CardDescription>SHIFT has not granted external role management for this account.</CardDescription>
            </CardHeader>
        </Card>

        <Card v-else data-testid="external-role-manager">
            <CardHeader>
                <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle>External Roles</CardTitle>
                        <CardDescription>Roles are stored in SHIFT for users discovered from this app.</CardDescription>
                    </div>
                    <Badge variant="secondary">
                        <Shield />
                        {{ visibleUsers.length }} users
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div v-if="visibleUsers.length === 0" class="text-muted-foreground py-8 text-center text-sm">No external users available.</div>
                <div v-else class="flex flex-col gap-3">
                    <div
                        v-for="user in visibleUsers"
                        :key="userKey(user)"
                        class="grid gap-3 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-center"
                    >
                        <div class="min-w-0">
                            <div class="truncate text-sm font-medium">{{ user.name }}</div>
                            <div class="text-muted-foreground truncate text-xs">{{ user.email }}</div>
                        </div>
                        <select
                            v-model="roleDrafts[userKey(user)]"
                            class="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            :aria-label="`External role for ${user.name}`"
                            :disabled="savingUserId === userKey(user)"
                        >
                            <option v-for="role in roles" :key="role.value" :value="role.value">
                                {{ role.label }}
                            </option>
                        </select>
                        <Button
                            class="w-full md:w-auto"
                            :disabled="savingUserId === userKey(user) || !hasChanged(user)"
                            @click="saveRole(user)"
                        >
                            <Check />
                            Save
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    </div>
</template>
