<script setup lang="ts">
import axios from '@/axios-config';
import { Badge } from '@shift/ui/badge';
import { Button } from '@shift/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shift/ui/card';
import { Input } from '@shift/ui/input';
import { Skeleton } from '@shift/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shift/ui/table';
import { Check, ChevronLeft, ChevronRight, RefreshCw, Shield } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { toast } from 'vue-sonner';
import ExternalRoleSelect from './ExternalRoleSelect.vue';
import {
    fallbackRoles,
    type ExternalRolePagination,
    type ExternalRoleResponse,
    type ExternalUserRole,
    type RoleOption,
} from './external-role-settings';
const perPage = 10;

const loading = ref(true);
const error = ref<string | null>(null);
const canManageExternalRoles = ref(false);
const roles = ref<RoleOption[]>(fallbackRoles.map((role) => normalizeRoleOption(role)));
const users = ref<ExternalUserRole[]>([]);
const roleDrafts = ref<Record<string, string>>({});
const savingUserId = ref<string | null>(null);
const searchTerm = ref('');
const currentPage = ref(1);
const lastPage = ref(1);
const totalUsers = ref(0);
const from = ref<number | null>(null);
const to = ref<number | null>(null);
const pageInput = ref('1');
let searchTimer: number | null = null;
let latestRequest = 0;

const visibleUsers = computed(() => (canManageExternalRoles.value ? users.value : []));
const roleGroups = computed(() => {
    const grouped = new Map<string, RoleOption[]>();

    for (const role of roles.value) {
        const options = grouped.get(role.group) ?? [];
        options.push(role);
        grouped.set(role.group, options);
    }

    return Array.from(grouped, ([label, options]) => ({ label, options }));
});
const numberedPages = computed(() => {
    if (lastPage.value <= 7) {
        return Array.from({ length: lastPage.value }, (_, index) => index + 1);
    }

    const start = Math.max(1, Math.min(currentPage.value - 2, lastPage.value - 4));
    return Array.from({ length: 5 }, (_, index) => start + index);
});

onMounted(() => {
    void fetchExternalRoles();
});

onBeforeUnmount(() => {
    if (searchTimer !== null) {
        window.clearTimeout(searchTimer);
    }
});

watch(searchTerm, () => {
    if (searchTimer !== null) {
        window.clearTimeout(searchTimer);
    }

    searchTimer = window.setTimeout(() => {
        currentPage.value = 1;
        void fetchExternalRoles(1);
    }, 300);
});

watch(currentPage, (page) => {
    pageInput.value = String(page);
});

async function fetchExternalRoles(page = currentPage.value) {
    const request = ++latestRequest;
    loading.value = true;
    error.value = null;

    try {
        const response = await axios.get('/shift/api/external-roles', {
            params: {
                paginate: 1,
                page,
                per_page: perPage,
                ...(searchTerm.value.trim() ? { search: searchTerm.value.trim() } : {}),
            },
        });

        if (request !== latestRequest) return;

        const payload = response.data as ExternalRoleResponse;
        const responseUsers = Array.isArray(payload.users) ? payload.users : [];

        canManageExternalRoles.value = payload.capabilities?.can_manage_external_roles === true;
        roles.value = payload.roles?.length
            ? payload.roles.map((role) => normalizeRoleOption(role))
            : fallbackRoles.map((role) => normalizeRoleOption(role));

        const pagination = normalizePagination(payload.pagination);
        if (pagination) {
            users.value = responseUsers;
            currentPage.value = pagination.current_page;
            lastPage.value = pagination.last_page;
            totalUsers.value = pagination.total;
            from.value = pagination.from;
            to.value = pagination.to;
        } else {
            applyLegacyPagination(responseUsers, page);
        }

        roleDrafts.value = Object.fromEntries(users.value.map((user) => [userKey(user), String(user.role || 'guest')]));
    } catch (exception: any) {
        if (request !== latestRequest) return;

        error.value = exception?.response?.data?.error || exception?.response?.data?.message || 'Unable to load external roles.';
        canManageExternalRoles.value = false;
        users.value = [];
        totalUsers.value = 0;
        from.value = null;
        to.value = null;
    } finally {
        if (request === latestRequest) {
            loading.value = false;
        }
    }
}

function applyLegacyPagination(responseUsers: ExternalUserRole[], page: number) {
    totalUsers.value = responseUsers.length;
    lastPage.value = Math.max(1, Math.ceil(totalUsers.value / perPage));
    currentPage.value = Math.min(page, lastPage.value);
    users.value = responseUsers.slice((currentPage.value - 1) * perPage, currentPage.value * perPage);
    from.value = totalUsers.value === 0 ? null : (currentPage.value - 1) * perPage + 1;
    to.value = totalUsers.value === 0 ? null : Math.min(currentPage.value * perPage, totalUsers.value);
}

function normalizePagination(pagination: Partial<ExternalRolePagination> | undefined): ExternalRolePagination | null {
    const current = Number(pagination?.current_page);
    const last = Number(pagination?.last_page);
    const size = Number(pagination?.per_page);
    const total = Number(pagination?.total);

    if (![current, last, size, total].every(Number.isInteger) || current < 1 || last < 1 || size < 1 || total < 0) {
        return null;
    }

    return {
        current_page: current,
        last_page: last,
        per_page: size,
        total,
        from: typeof pagination?.from === 'number' ? pagination.from : null,
        to: typeof pagination?.to === 'number' ? pagination.to : null,
    };
}

async function goToPage(page: number) {
    const nextPage = Math.max(1, Math.min(lastPage.value, page));
    if (nextPage === currentPage.value) return;

    currentPage.value = nextPage;
    await fetchExternalRoles(nextPage);
}

function submitPage() {
    const page = Number.parseInt(pageInput.value, 10);
    void goToPage(Number.isFinite(page) ? page : currentPage.value);
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
        users.value = users.value.map((candidate) => (userKey(candidate) === key ? { ...candidate, role: updatedRole } : candidate));
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
    const value = String(role || 'guest');

    return roles.value.find((option) => option.value === value)?.label || fallbackRoleLabel(value);
}

function fallbackRoleLabel(role: string): string {
    if (role === 'owner') return 'Owner';
    if (role === 'client_developer') return 'Developer';

    return role
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function fallbackRoleGroup(role: string): string {
    return role === 'shift_lead_developer' || role === 'shift_developer' ? 'SHIFT roles' : 'App roles';
}

function normalizeRoleOption(role: string | Partial<RoleOption>): RoleOption {
    if (typeof role === 'string') {
        return {
            value: role,
            label: fallbackRoleLabel(role),
            group: fallbackRoleGroup(role),
        };
    }

    const value = String(role.value || 'guest');

    return {
        value,
        label: role.label || fallbackRoleLabel(value),
        group: role.group || fallbackRoleGroup(value),
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
            <Button variant="outline" :disabled="loading" @click="fetchExternalRoles()">
                <RefreshCw data-icon="inline-start" />
                Refresh
            </Button>
        </div>

        <Card v-if="error" class="border-destructive/40" data-testid="external-role-error">
            <CardHeader>
                <CardTitle>Settings unavailable</CardTitle>
                <CardDescription>{{ error }}</CardDescription>
            </CardHeader>
            <CardContent>
                <Button @click="fetchExternalRoles()">Retry</Button>
            </CardContent>
        </Card>

        <Card v-else-if="!loading && !canManageExternalRoles" data-testid="external-role-denied">
            <CardHeader>
                <CardTitle>Settings unavailable</CardTitle>
                <CardDescription>SHIFT has not granted external role management for this account.</CardDescription>
            </CardHeader>
        </Card>

        <section v-else class="rounded-md border" data-testid="external-role-manager" :aria-busy="loading">
            <div class="flex flex-col gap-4 border-b px-4 py-4">
                <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 class="text-lg font-semibold">External Roles</h2>
                        <p class="text-muted-foreground text-sm">Roles are stored in SHIFT for users discovered from this app.</p>
                    </div>
                    <Badge variant="secondary">
                        <Shield />
                        {{ totalUsers }} users
                    </Badge>
                </div>

                <div class="max-w-md">
                    <label class="text-muted-foreground mb-2 block text-sm" for="external-role-search">Search users</label>
                    <Input
                        id="external-role-search"
                        v-model="searchTerm"
                        data-testid="external-role-search"
                        placeholder="Search by name or email"
                        type="search"
                    />
                </div>
            </div>

            <div v-if="loading" class="flex flex-col gap-3 p-4" data-testid="external-role-loading">
                <Skeleton v-for="index in 4" :key="index" class="h-14 w-full" />
            </div>

            <div v-else-if="visibleUsers.length === 0" class="text-muted-foreground py-8 text-center text-sm" data-testid="external-role-empty">
                {{ searchTerm.trim() ? 'No users match this search.' : 'No external users available.' }}
            </div>

            <template v-else>
                <div class="hidden md:block">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Current role</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead class="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow v-for="user in visibleUsers" :key="userKey(user)" :data-testid="`external-role-row-${userKey(user)}`">
                                <TableCell class="min-w-[16rem] whitespace-normal">
                                    <div class="min-w-0">
                                        <div class="truncate font-medium">{{ user.name }}</div>
                                        <div class="text-muted-foreground truncate text-sm">{{ user.email }}</div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" :data-testid="`external-role-current-${userKey(user)}`">
                                        {{ roleLabel(user.role) }}
                                    </Badge>
                                </TableCell>
                                <TableCell class="w-[15rem]">
                                    <ExternalRoleSelect
                                        v-model="roleDrafts[userKey(user)]"
                                        :label="`External role for ${user.name}`"
                                        :disabled="savingUserId === userKey(user)"
                                        :groups="roleGroups"
                                    />
                                </TableCell>
                                <TableCell>
                                    <div class="flex justify-end">
                                        <Button size="sm" :disabled="savingUserId === userKey(user) || !hasChanged(user)" @click="saveRole(user)">
                                            <Check data-icon="inline-start" />
                                            Save
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>

                <div class="divide-y md:hidden">
                    <div
                        v-for="user in visibleUsers"
                        :key="userKey(user)"
                        class="grid gap-3 p-4"
                        :data-testid="`external-role-mobile-row-${userKey(user)}`"
                    >
                        <div class="flex min-w-0 flex-col gap-2">
                            <div>
                                <div class="truncate text-sm font-medium">{{ user.name }}</div>
                                <div class="text-muted-foreground truncate text-xs">{{ user.email }}</div>
                            </div>
                            <Badge variant="outline" :data-testid="`external-role-mobile-current-${userKey(user)}`">
                                {{ roleLabel(user.role) }}
                            </Badge>
                        </div>
                        <ExternalRoleSelect
                            v-model="roleDrafts[userKey(user)]"
                            :label="`External role for ${user.name}`"
                            :disabled="savingUserId === userKey(user)"
                            :groups="roleGroups"
                        />
                        <Button class="w-full" :disabled="savingUserId === userKey(user) || !hasChanged(user)" @click="saveRole(user)">
                            <Check data-icon="inline-start" />
                            Save
                        </Button>
                    </div>
                </div>
            </template>

            <div v-if="!loading && totalUsers > 0" class="flex flex-col gap-3 border-t px-4 py-4" data-testid="external-role-pagination">
                <div class="text-muted-foreground text-center text-xs sm:text-left">
                    Showing {{ from ?? 0 }} to {{ to ?? 0 }} of {{ totalUsers }} users
                </div>

                <div class="flex items-center justify-between gap-2 md:hidden">
                    <Button
                        aria-label="Previous user page"
                        data-testid="external-role-previous"
                        size="sm"
                        variant="outline"
                        :disabled="currentPage === 1"
                        @click="goToPage(currentPage - 1)"
                    >
                        <ChevronLeft data-icon="inline-start" />
                        Previous
                    </Button>
                    <form class="flex items-center gap-2" @submit.prevent="submitPage">
                        <label class="text-muted-foreground text-xs" for="external-role-page">Page</label>
                        <Input
                            id="external-role-page"
                            v-model="pageInput"
                            aria-label="User page"
                            class="w-16"
                            data-testid="external-role-page-input"
                            inputmode="numeric"
                        />
                        <span class="text-muted-foreground text-xs">of {{ lastPage }}</span>
                    </form>
                    <Button
                        aria-label="Next user page"
                        data-testid="external-role-next"
                        size="sm"
                        variant="outline"
                        :disabled="currentPage === lastPage"
                        @click="goToPage(currentPage + 1)"
                    >
                        Next
                        <ChevronRight data-icon="inline-end" />
                    </Button>
                </div>

                <div class="hidden items-center justify-end gap-2 md:flex">
                    <Button
                        aria-label="Previous user page"
                        size="sm"
                        variant="outline"
                        :disabled="currentPage === 1"
                        @click="goToPage(currentPage - 1)"
                    >
                        <ChevronLeft data-icon="inline-start" />
                        Previous
                    </Button>
                    <Button
                        v-for="page in numberedPages"
                        :key="page"
                        :aria-current="page === currentPage ? 'page' : undefined"
                        :aria-label="`User page ${page}`"
                        :data-testid="`external-role-page-${page}`"
                        size="sm"
                        :variant="page === currentPage ? 'default' : 'outline'"
                        @click="goToPage(page)"
                    >
                        {{ page }}
                    </Button>
                    <Button
                        aria-label="Next user page"
                        size="sm"
                        variant="outline"
                        :disabled="currentPage === lastPage"
                        @click="goToPage(currentPage + 1)"
                    >
                        Next
                        <ChevronRight data-icon="inline-end" />
                    </Button>
                </div>
            </div>
        </section>
    </div>
</template>
