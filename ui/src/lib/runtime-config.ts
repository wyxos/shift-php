export function getRuntimeAppEnvironment(): string {
    return window.shiftConfig?.appEnvironment || import.meta.env.VITE_APP_ENV || 'production';
}
