export function frontendBuild(): { frontend_build_id?: string; frontend_sdk_revision?: string } {
    const buildId = typeof __SHIFT_UI_BUILD_ID__ === 'string' && /^[a-f0-9]{64}$/.test(__SHIFT_UI_BUILD_ID__)
        ? __SHIFT_UI_BUILD_ID__ : undefined;
    const revision = typeof __SHIFT_UI_SDK_REVISION__ === 'string' && /^[a-f0-9]{40}$/.test(__SHIFT_UI_SDK_REVISION__)
        ? __SHIFT_UI_SDK_REVISION__ : undefined;
    return {
        ...(buildId ? { frontend_build_id: buildId } : {}),
        ...(revision ? { frontend_sdk_revision: revision } : {}),
    };
}
