/// <reference types="vite/client" />

interface Window {
    shiftConfig: {
        loginRoute: string;
        logoutRoute: string;
        baseUrl: string;
        appName: string;
        username: string;
        email?: string;
    };
}
