import { installWorkspaceErrorReporting, reportWorkspaceError } from './error-reporting';

installWorkspaceErrorReporting();

void import('./workspace').catch((error: unknown) => {
    reportWorkspaceError(error, { operation: 'startup' });
});
