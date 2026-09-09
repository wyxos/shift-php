<script setup lang="ts">
import { ArrowLeft, CheckCircle2, Loader2, LogIn, MessageSquare, X } from 'lucide-vue-next';
import { computed, onMounted, reactive, ref } from 'vue';

type WidgetKind = 'task' | 'feature' | 'issue';
type IdentityMode = 'account' | 'anonymous' | 'details' | 'login';

interface WidgetUser {
    id?: number | string | null;
    name?: string | null;
    email?: string | null;
}

interface WidgetRuntimeConfig {
    endpoints: {
        config: string;
        tasks: string;
        sessionUser: string;
        login: string;
    };
    csrfToken?: string;
    guestSubmissionsEnabled: boolean;
    authenticated: boolean;
    requiresAuthentication?: boolean;
    loginCredentialField: string;
    appName: string;
}

interface ApiError {
    status: number;
    body: {
        message?: string;
        errors?: Record<string, string[]>;
    };
}

const props = defineProps<{
    config: WidgetRuntimeConfig;
}>();

const kindOptions: WidgetKind[] = ['task', 'feature', 'issue'];
const ready = ref(false);
const isOpen = ref(false);
const submitting = ref(false);
const loggingIn = ref(false);
const success = ref(false);
const formSelected = ref(false);
const submittedFeedbackUrl = ref<string | null>(null);
const kind = ref<WidgetKind>('task');
const title = ref('');
const description = ref('');
const anonymous = ref(false);
const identityMode = ref<IdentityMode>(props.config.authenticated ? 'account' : props.config.guestSubmissionsEnabled ? 'anonymous' : 'login');
const sessionUser = ref<WidgetUser | null>(null);
const guestDetails = reactive({ name: '', email: '' });
const loginDraft = reactive({ credential: '', password: '' });
const errors = ref<Record<string, string[]>>({});
const loginErrors = ref<Record<string, string[]>>({});
const generalError = ref<string | null>(null);
const loginError = ref<string | null>(null);
const csrfToken = ref(props.config.csrfToken || null);

const remoteConfig = reactive({
    widgetEnabled: true,
    workspaceUrl: null as string | null,
    guestSubmissionsEnabled: props.config.guestSubmissionsEnabled,
    requiresAuthentication: Boolean(props.config.requiresAuthentication),
    loginCredentialField: props.config.loginCredentialField || 'email',
});

const isAuthenticated = computed(() => Boolean(sessionUser.value));
const workspaceUrl = computed(() => isAuthenticated.value ? remoteConfig.workspaceUrl : null);
const showMenu = computed(() => Boolean(workspaceUrl.value) && !formSelected.value && !success.value);
const isAnonymousSubmission = computed(() => {
    if (isAuthenticated.value) {
        return anonymous.value;
    }

    return identityMode.value === 'anonymous';
});
const canSubmit = computed(() => {
    if (submitting.value || title.value.trim() === '' || description.value.trim() === '') {
        return false;
    }

    return identityMode.value !== 'login' || isAuthenticated.value;
});
const shouldRender = computed(() => {
    return ready.value && remoteConfig.widgetEnabled;
});
const credentialLabel = computed(() => {
    return remoteConfig.loginCredentialField === 'email' ? 'Email' : toTitle(remoteConfig.loginCredentialField);
});

onMounted(async () => {
    await loadState();
    ready.value = true;
});

async function loadState() {
    try {
        const [configResponse, userResponse] = await Promise.all([
            apiJson<{
                widget_enabled: boolean;
                workspace_url?: string | null;
                guest_submissions_enabled: boolean;
                requires_authentication?: boolean;
                login_credential_field?: string;
            }>(props.config.endpoints.config),
            apiJson<{ authenticated: boolean; user: WidgetUser | null }>(props.config.endpoints.sessionUser),
        ]);

        remoteConfig.widgetEnabled = configResponse.widget_enabled;
        remoteConfig.workspaceUrl = configResponse.workspace_url || null;
        remoteConfig.guestSubmissionsEnabled = configResponse.guest_submissions_enabled;
        remoteConfig.requiresAuthentication = Boolean(configResponse.requires_authentication);
        remoteConfig.loginCredentialField = configResponse.login_credential_field || remoteConfig.loginCredentialField;
        sessionUser.value = userResponse.authenticated ? userResponse.user : null;
        identityMode.value = sessionUser.value ? 'account' : remoteConfig.guestSubmissionsEnabled ? 'anonymous' : 'login';
    } catch {
        remoteConfig.widgetEnabled = false;
    }
}

async function submitReport() {
    if (!canSubmit.value) {
        return;
    }

    submitting.value = true;
    errors.value = {};
    generalError.value = null;

    try {
        const payload: Record<string, unknown> = {
            kind: kind.value,
            title: title.value,
            description: description.value,
            anonymous: isAnonymousSubmission.value,
            metadata: {
                page_url: window.location.href,
                page_title: document.title,
                referrer: document.referrer || null,
            },
        };

        if (!isAnonymousSubmission.value && !isAuthenticated.value && identityMode.value === 'details') {
            payload.user = {
                name: guestDetails.name,
                email: guestDetails.email,
            };
        }

        const response = await apiJson<{ id: number | string }>(props.config.endpoints.tasks, {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        submittedFeedbackUrl.value = null;
        if (workspaceUrl.value && !isAnonymousSubmission.value && response.id != null) {
            const url = new URL(workspaceUrl.value, window.location.href);
            url.searchParams.set('task', String(response.id));
            submittedFeedbackUrl.value = url.href;
        }
        success.value = true;
    } catch (error) {
        applyError(error, errors, generalError);
    } finally {
        submitting.value = false;
    }
}

async function login() {
    loggingIn.value = true;
    loginErrors.value = {};
    loginError.value = null;

    try {
        const credentialField = remoteConfig.loginCredentialField;
        const response = await apiJson<{ authenticated: boolean; csrf_token?: string; user: WidgetUser }>(props.config.endpoints.login, {
            method: 'POST',
            body: JSON.stringify({
                [credentialField]: loginDraft.credential,
                credential: loginDraft.credential,
                password: loginDraft.password,
            }),
        });

        sessionUser.value = response.user;
        csrfToken.value = response.csrf_token || csrfToken.value;
        identityMode.value = 'account';
        anonymous.value = false;
        loginDraft.password = '';
        formSelected.value = true;
        const configResponse = await apiJson<{ workspace_url?: string | null }>(props.config.endpoints.config).catch(() => null);
        remoteConfig.workspaceUrl = configResponse?.workspace_url || null;
    } catch (error) {
        applyError(error, loginErrors, loginError);
    } finally {
        loggingIn.value = false;
    }
}

function resetForm() {
    success.value = false;
    submittedFeedbackUrl.value = null;
    formSelected.value = true;
    title.value = '';
    description.value = '';
    kind.value = 'task';
    anonymous.value = false;
    errors.value = {};
    generalError.value = null;

    if (!isAuthenticated.value) {
        identityMode.value = remoteConfig.guestSubmissionsEnabled ? 'anonymous' : 'login';
        guestDetails.name = '';
        guestDetails.email = '';
    }
}

async function apiJson<T>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
        credentials: 'same-origin',
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(csrfToken.value ? { 'X-CSRF-TOKEN': csrfToken.value } : {}),
            ...(options.headers || {}),
        },
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw { status: response.status, body } satisfies ApiError;
    }

    return body as T;
}

function applyError(
    error: unknown,
    targetErrors: typeof errors,
    targetMessage: typeof generalError,
) {
    if (isApiError(error)) {
        targetErrors.value = error.body.errors || {};
        targetMessage.value = error.body.message || null;
        return;
    }

    targetMessage.value = 'SHIFT could not process this request.';
}

function isApiError(error: unknown): error is ApiError {
    return typeof error === 'object' && error !== null && 'status' in error && 'body' in error;
}

function setIdentityMode(mode: IdentityMode) {
    identityMode.value = mode;

    if (mode !== 'account') {
        anonymous.value = mode === 'anonymous';
    }
}

function firstError(field: string): string | null {
    return errors.value[field]?.[0] || null;
}

function firstLoginError(field: string): string | null {
    return loginErrors.value[field]?.[0] || null;
}

function toTitle(value: string): string {
    return value
        .replace(/[_-]+/g, ' ')
        .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}
</script>

<template>
    <div v-if="shouldRender" class="shift-widget" :class="{ 'shift-widget--open': isOpen }">
        <button v-if="!isOpen" class="shift-widget__launcher" type="button" aria-label="Feedback" @click="isOpen = true">
            <MessageSquare aria-hidden="true" />
            <span>Feedback</span>
        </button>

        <section v-else class="shift-widget__panel" aria-label="Feedback">
            <header class="shift-widget__header">
                <div>
                    <p class="shift-widget__eyebrow">{{ props.config.appName }}</p>
                    <h2>Feedback</h2>
                </div>
                <div class="shift-widget__actions">
                    <button v-if="workspaceUrl && !showMenu && !success" class="shift-widget__icon-button" type="button" aria-label="Back" title="Back" @click="formSelected = false">
                        <ArrowLeft aria-hidden="true" />
                    </button>
                    <button class="shift-widget__icon-button" type="button" aria-label="Close" @click="isOpen = false">
                        <X aria-hidden="true" />
                    </button>
                </div>
            </header>

            <div v-if="showMenu" class="shift-widget__menu">
                <a class="shift-widget__button shift-widget__button--secondary" :href="workspaceUrl!" target="_blank" rel="noopener noreferrer">My requests</a>
                <button class="shift-widget__button" type="button" @click="formSelected = true">Submit a request</button>
            </div>

            <div v-else-if="success" class="shift-widget__success">
                <CheckCircle2 aria-hidden="true" />
                <h3>Request submitted</h3>
                <div class="shift-widget__success-actions">
                    <a v-if="submittedFeedbackUrl" class="shift-widget__button" :href="submittedFeedbackUrl" target="_blank" rel="noopener noreferrer">View request</a>
                    <button class="shift-widget__button shift-widget__button--secondary" type="button" @click="resetForm">Add another</button>
                    <button class="shift-widget__button shift-widget__button--secondary" type="button" @click="isOpen = false">
                        Close
                    </button>
                </div>
            </div>

            <form v-else class="shift-widget__form" @submit.prevent="submitReport">
                <div class="shift-widget__segmented" aria-label="Request type">
                    <button v-for="option in kindOptions" :key="option" type="button" :aria-pressed="kind === option" @click="kind = option">
                        {{ toTitle(option) }}
                    </button>
                </div>

                <label class="shift-widget__field">
                    <span>Title</span>
                    <input v-model="title" type="text" autocomplete="off" :aria-invalid="Boolean(firstError('title'))" />
                    <small v-if="firstError('title')">{{ firstError('title') }}</small>
                </label>

                <label class="shift-widget__field">
                    <span>Description</span>
                    <textarea v-model="description" rows="5" :aria-invalid="Boolean(firstError('description'))"></textarea>
                    <small v-if="firstError('description')">{{ firstError('description') }}</small>
                </label>

                <div class="shift-widget__identity">
                    <template v-if="isAuthenticated">
                        <div class="shift-widget__account">
                            <span>{{ sessionUser?.name || sessionUser?.email || 'Signed in' }}</span>
                            <small v-if="sessionUser?.email">{{ sessionUser.email }}</small>
                        </div>
                        <label v-if="remoteConfig.guestSubmissionsEnabled" class="shift-widget__check">
                            <input v-model="anonymous" type="checkbox" />
                            <span>Send anonymously</span>
                        </label>
                    </template>

                    <template v-else>
                        <div v-if="remoteConfig.guestSubmissionsEnabled" class="shift-widget__segmented" aria-label="Your identity">
                            <button type="button" :aria-pressed="identityMode === 'anonymous'" @click="setIdentityMode('anonymous')">
                                Anonymous
                            </button>
                            <button type="button" :aria-pressed="identityMode === 'details'" @click="setIdentityMode('details')">
                                Contact details
                            </button>
                            <button type="button" :aria-pressed="identityMode === 'login'" @click="setIdentityMode('login')">
                                Log in
                            </button>
                        </div>

                        <div v-else-if="remoteConfig.requiresAuthentication" class="shift-widget__account">
                            <span>Log in required</span>
                            <small>Log in to submit a request from {{ props.config.appName }}.</small>
                        </div>

                        <div v-if="remoteConfig.guestSubmissionsEnabled && identityMode === 'details'" class="shift-widget__grid">
                            <label class="shift-widget__field">
                                <span>Name</span>
                                <input v-model="guestDetails.name" type="text" autocomplete="name" />
                            </label>
                            <label class="shift-widget__field">
                                <span>Email</span>
                                <input v-model="guestDetails.email" type="email" autocomplete="email" :aria-invalid="Boolean(firstError('user.email'))" />
                                <small v-if="firstError('user.email')">{{ firstError('user.email') }}</small>
                            </label>
                        </div>

                        <div v-if="identityMode === 'login'" class="shift-widget__login">
                            <label class="shift-widget__field">
                                <span>{{ credentialLabel }}</span>
                                <input
                                    v-model="loginDraft.credential"
                                    type="text"
                                    autocomplete="username"
                                    :aria-invalid="Boolean(firstLoginError(remoteConfig.loginCredentialField))"
                                />
                                <small v-if="firstLoginError(remoteConfig.loginCredentialField)">
                                    {{ firstLoginError(remoteConfig.loginCredentialField) }}
                                </small>
                            </label>
                            <label class="shift-widget__field">
                                <span>Password</span>
                                <input v-model="loginDraft.password" type="password" autocomplete="current-password" />
                            </label>
                            <p v-if="loginError" class="shift-widget__error">{{ loginError }}</p>
                            <button class="shift-widget__button shift-widget__button--secondary" type="button" :disabled="loggingIn" @click="login">
                                <Loader2 v-if="loggingIn" class="shift-widget__spin" aria-hidden="true" />
                                <LogIn v-else aria-hidden="true" />
                                <span>{{ loggingIn ? 'Checking...' : 'Log in' }}</span>
                            </button>
                        </div>
                    </template>
                </div>

                <p v-if="generalError" class="shift-widget__error">{{ generalError }}</p>

                <footer class="shift-widget__footer">
                    <button class="shift-widget__button shift-widget__button--secondary" type="button" @click="isOpen = false">Cancel</button>
                    <button class="shift-widget__button" type="submit" :disabled="!canSubmit">
                        <span>{{ submitting ? 'Sending...' : 'Send' }}</span>
                    </button>
                </footer>
            </form>
        </section>
    </div>
</template>
