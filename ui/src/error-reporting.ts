import type { App } from 'vue';
import type { Router } from 'vue-router';
import { frontendBuild } from './frontend-build';

type ErrorContext = {
    operation: string;
    component?: string;
    correlation_id?: string;
    http_status?: number;
};

let active = false;
let sent = 0;
let reported = new WeakSet<object>();
const signatures = new Set<string>();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validCorrelationId(value: unknown): string | undefined {
    return typeof value === 'string' && uuidPattern.test(value) ? value : undefined;
}

function correlationHeader(headers: unknown): string | undefined {
    if (typeof headers !== 'object' || headers === null) {
        return undefined;
    }
    const values = headers as { get?: (name: string) => unknown; [name: string]: unknown };
    if (typeof values.get === 'function') {
        return validCorrelationId(values.get('X-Shift-Correlation-ID'));
    }
    return validCorrelationId(Object.entries(values).find(([name]) => name.toLowerCase() === 'x-shift-correlation-id')?.[1]);
}

function endpoint(): URL | null {
    const url = new URL(window.shiftConfig?.errorReportingEndpoint ?? '/shift/api/errors', window.location.origin);
    return url.origin === window.location.origin ? url : null;
}

function clean(value: string, limit: number): string {
    return value
        .replace(/(https?:\/\/[^\s?#)]+)[?#][^\s)]*/gi, '$1')
        .replace(/\b(Bearer\s+)[^\s]+/gi, '$1[redacted]')
        .replace(/\b(password|token|secret|authorization|cookie)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
        .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
        .slice(0, limit);
}

export function reportWorkspaceError(error: unknown, context: ErrorContext): void {
    if (!active || window.shiftConfig?.errorReportingEnabled === false || sent >= 20) {
        return;
    }

    try {
        const destination = endpoint();
        if (!destination || (typeof error === 'object' && error !== null && reported.has(error))) {
            return;
        }

        const name = error instanceof Error ? error.name : 'Error';
        const message = clean(error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unexpected SHIFT UI error', 2000);
        const stack = clean(error instanceof Error ? error.stack ?? '' : '', 12000);
        const signature = `${name}:${message}:${stack}`;
        if (signatures.has(signature)) {
            return;
        }

        signatures.add(signature);
        if (typeof error === 'object' && error !== null) {
            reported.add(error);
        }
        sent++;

        const csrf = window.shiftConfig?.errorReportingCsrfToken ?? window.shiftConfig?.csrfToken
            ?? document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content;
        const { correlation_id: suppliedCorrelation, ...safeContext } = context;
        const correlation = validCorrelationId(suppliedCorrelation);
        void fetch(destination.href, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                ...(csrf ? { 'X-CSRF-TOKEN': csrf } : {}),
                ...(correlation ? { 'X-Shift-Correlation-ID': correlation } : {}),
            },
            body: JSON.stringify({
                source: 'ui',
                ...frontendBuild(),
                error: { name: clean(name, 255), message },
                stack,
                context: {
                    ...safeContext,
                    ...(correlation ? { correlation_id: correlation } : {}),
                    operation: clean(context.operation, 255),
                    ...(context.component ? { component: clean(context.component, 255) } : {}),
                    route: clean(window.location.pathname, 2048),
                },
            }),
            keepalive: true,
        }).catch(() => undefined);
    } catch {
        // Reporting must never replace the original application failure.
    }
}

function attributable(error: unknown, filename = ''): boolean {
    const stack = error instanceof Error ? error.stack ?? '' : '';
    const source = `${filename}\n${stack}`;
    const moduleDirectory = new URL(import.meta.url);
    moduleDirectory.pathname = moduleDirectory.pathname.slice(0, moduleDirectory.pathname.lastIndexOf('/') + 1);
    moduleDirectory.search = '';
    moduleDirectory.hash = '';
    return (source.includes('/shift-assets/') || source.includes(moduleDirectory.href))
        && !/(?:chrome|moz|safari-web)-extension:\/\//.test(source);
}

export function installWorkspaceErrorReporting(): () => void {
    active = true;
    sent = 0;
    reported = new WeakSet<object>();
    signatures.clear();
    const onError = (event: Event): void => {
        if (event instanceof ErrorEvent && attributable(event.error, event.filename)) {
            reportWorkspaceError(event.error ?? event.message, { operation: 'runtime' });
        } else if (event.target instanceof HTMLScriptElement || event.target instanceof HTMLLinkElement) {
            const source = event.target instanceof HTMLScriptElement ? event.target.src : event.target.href;
            if (attributable(null, source)) {
                reportWorkspaceError(new Error(`Failed to load SHIFT asset: ${source}`), { operation: 'asset' });
            }
        }
    };
    const onRejection = (event: PromiseRejectionEvent): void => {
        if (attributable(event.reason)) {
            reportWorkspaceError(event.reason, { operation: 'promise' });
        }
    };
    window.addEventListener('error', onError, true);
    window.addEventListener('unhandledrejection', onRejection);

    return () => {
        active = false;
        window.removeEventListener('error', onError, true);
        window.removeEventListener('unhandledrejection', onRejection);
    };
}

export function configureWorkspaceErrorReporting(app: App, router: Router): void {
    const previous = app.config.errorHandler;
    app.config.errorHandler = (error, instance, info) => {
        reportWorkspaceError(error, {
            operation: `vue:${info}`,
            component: instance?.$options.name ?? instance?.$options.__name,
        });
        if (previous) {
            previous(error, instance, info);
        } else {
            console.error(error);
        }
    };
    router.onError((error) => reportWorkspaceError(error, { operation: 'navigation' }));
}

export function reportWorkspaceRequestError(error: unknown): void {
    if (typeof error !== 'object' || error === null) {
        return;
    }

    const requestError = error as {
        code?: string;
        config?: { url?: string; method?: string; baseURL?: string; headers?: unknown };
        response?: { status?: number; headers?: Record<string, string> };
    };
    const status = requestError.response?.status;
    const url = requestError.config?.url;
    if (!url || requestError.code === 'ERR_CANCELED' || (status !== undefined && status < 500)) {
        reported.add(error);
        return;
    }

    try {
        const base = new URL(requestError.config?.baseURL ?? window.location.origin, window.location.origin);
        const destination = new URL(url, base);
        const reportingEndpoint = endpoint();
        if (destination.origin !== window.location.origin || !destination.pathname.includes('/shift/api/')
            || destination.pathname === reportingEndpoint?.pathname) {
            reported.add(error);
            return;
        }

        if (['1', 'true'].includes(requestError.response?.headers?.['x-shift-error-reported'] ?? '')) {
            reported.add(error);
            return;
        }
        const operationPath = destination.pathname.split('/').map((segment) => /^\d+$/.test(segment) || uuidPattern.test(segment) ? ':id' : segment).join('/');
        reportWorkspaceError(error, {
            operation: `${(requestError.config?.method ?? 'get').toUpperCase()} ${operationPath}`,
            http_status: status,
            correlation_id: correlationHeader(requestError.response?.headers) ?? correlationHeader(requestError.config?.headers),
        });
    } catch {
        // Ignore malformed or unsupported request destinations.
    }
}
