/// <reference types="vite/client" />

interface Window {
    shiftConfig: {
        loginRoute: string;
        logoutRoute: string;
        baseUrl: string;
        appName: string;
        username: string;
        email?: string;
        aiEnabled: boolean;
        appEnvironment?: string;
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
