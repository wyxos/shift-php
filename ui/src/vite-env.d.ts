/// <reference types="vite/client" />

interface ShiftConfig {
  loginRoute?: string;
}

interface Window {
  shiftConfig?: ShiftConfig;
}
