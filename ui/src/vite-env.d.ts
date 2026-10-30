/// <reference types="vite/client" />

interface Window {
    shiftConfig: {
        loginRoute: string;
        logoutRoute: string | null;
        logoutMethod?: 'POST' | 'DELETE' | 'PUT' | 'PATCH' | null;
        csrfToken?: string | null;
        errorReportingEnabled?: boolean;
        errorReportingEndpoint?: string;
        errorReportingCsrfToken?: string;
        baseUrl: string;
        appName: string;
        username: string;
        userId?: number | string | null;
        email?: string;
        aiEnabled: boolean;
        appEnvironment?: string;
        shiftUrl?: string;
    };
    shiftWidgetConfig?: {
        endpoints: {
            config: string;
            tasks: string;
            sessionUser: string;
            login: string;
        };
        csrfToken?: string;
        guestSubmissionsEnabled: boolean;
        authenticated: boolean;
        loginCredentialField: string;
        appName: string;
    };
}
