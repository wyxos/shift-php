import { afterEach, describe, expect, it, vi } from 'vitest';
import { frontendBuild } from '../frontend-build';

afterEach(() => vi.unstubAllGlobals());

describe('loaded frontend build identity', () => {
    it('reports the compiled build rather than PHP runtime configuration', () => {
        vi.stubGlobal('__SHIFT_UI_BUILD_ID__', 'a'.repeat(64));
        vi.stubGlobal('__SHIFT_UI_SDK_REVISION__', 'b'.repeat(40));
        window.shiftConfig = { frontend_build_id: 'server-cannot-override-loaded-build' } as unknown as Window['shiftConfig'];
        expect(frontendBuild()).toEqual({ frontend_build_id: 'a'.repeat(64), frontend_sdk_revision: 'b'.repeat(40) });
    });

    it('leaves development builds explicitly unidentified without compiled provenance', () => {
        expect(frontendBuild()).toEqual({});
        vi.stubGlobal('__SHIFT_UI_BUILD_ID__', 'not-a-build');
        vi.stubGlobal('__SHIFT_UI_SDK_REVISION__', null);
        expect(frontendBuild()).toEqual({});
    });
});
