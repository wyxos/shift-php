// @vitest-environment node
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { build } from 'vite';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { canonicalSourceLabel, sdkArtifacts } from './sdk-artifacts';
import { assertPrivateDirectory, BUILD_PLACEHOLDER, canonicalBuildId, sha256, storePrivateArtifacts, type PrivateManifest } from './sdk-artifact-store';

const temporary: string[] = [];
afterEach(async () => { await Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

async function fixture() {
    const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'shift-ui-build-')));
    temporary.push(directory);
    const uiRoot = path.join(directory, 'ui');
    const portalResources = path.join(directory, 'portal/resources/js');
    await mkdir(uiRoot, { recursive: true });
    await mkdir(portalResources, { recursive: true });
    await writeFile(path.join(uiRoot, 'package-lock.json'), '{}');
    await writeFile(path.join(uiRoot, 'index.html'), '<script type="module" src="/main.js"></script>');
    await writeFile(path.join(uiRoot, 'main.js'), 'const value = __SHIFT_UI_BUILD_ID__;\nwindow.loadedBuild = value;\nwindow.run = () => { throw new Error("Real component failure"); };\n');
    const publicDir = path.join(directory, 'public/shift-assets');
    const artifactDir = path.join(directory, 'private');
    const compile = async () => {
        await build({ root: uiRoot, configFile: false, logLevel: 'silent', plugins: sdkArtifacts({ uiRoot, portalResources, artifactDirectory: artifactDir }),
            build: { outDir: publicDir, minify: 'esbuild', manifest: true } });
        const builds = (await readdir(artifactDir)).filter((name) => /^[a-f0-9]{64}$/.test(name)).sort();
        const manifests = await Promise.all(builds.map(async (id) => JSON.parse(await readFile(path.join(artifactDir, id, 'manifest.json'), 'utf8')) as PrivateManifest));
        return { builds, manifests };
    };
    return { directory, uiRoot, publicDir, artifactDir, compile };
}

const provenance = { sdk_revision: null, sdk_dirty: null, portal_revision: null, portal_dirty: null };

describe('private SDK source-map artifacts', () => {
    it('embeds an output-derived ID, retains exact JS/maps privately, and resolves generated positions', async () => {
        const { publicDir, artifactDir, compile } = await fixture();
        const { builds, manifests } = await compile();
        expect(builds).toHaveLength(1);
        const manifest = manifests[0];
        expect(BUILD_PLACEHOLDER).toHaveLength(64);
        expect(JSON.parse(await readFile(path.join(artifactDir, 'latest.json'), 'utf8'))).toEqual({ schema_version: 1, build_id: manifest.build_id });
        expect(manifest).toMatchObject({ schema_version: 1, build_id: builds[0], sdk_revision: null });
        const [filename, asset] = Object.entries(manifest.assets)[0];
        const code = await readFile(path.join(publicDir, filename), 'utf8');
        expect(code).toContain(manifest.build_id);
        expect(code).not.toContain(BUILD_PLACEHOLDER);
        expect(code).not.toContain('sourceMappingURL');
        expect(await readFile(path.join(artifactDir, manifest.build_id, filename), 'utf8')).toBe(code);
        expect(sha256(code)).toBe(asset.sha256);
        const map = await readFile(path.join(artifactDir, manifest.build_id, asset.map), 'utf8');
        expect(sha256(map)).toBe(asset.map_sha256);
        const publicFiles = await readdir(path.join(publicDir, 'assets'));
        expect(publicFiles.some((name) => name.endsWith('.map'))).toBe(false);
        expect(code).not.toContain('sourcesContent');
        const position = code.indexOf('new Error');
        const preceding = code.slice(0, position);
        const generated = { line: preceding.split('\n').length, column: preceding.split('\n').at(-1)!.length };
        const original = originalPositionFor(new TraceMap(map), generated);
        expect(original.source).toBe('sdk/ui/main.js');
        expect(original.line).toBe(3);
    });

    it('reuses identical immutable builds and changes ID and asset URL when source-only comments change', async () => {
        const { uiRoot, compile } = await fixture();
        const first = await compile();
        const repeat = await compile();
        expect(repeat.builds).toEqual(first.builds);
        await writeFile(path.join(uiRoot, 'main.js'), '// changed source context\n' + await readFile(path.join(uiRoot, 'main.js'), 'utf8'));
        const changed = await compile();
        expect(changed.builds).toHaveLength(2);
        const manifests = changed.manifests;
        expect(Object.keys(manifests[0].assets)).not.toEqual(Object.keys(manifests[1].assets));
    });

    it('changes asset URLs when compiler configuration changes without runtime code changes', async () => {
        const { uiRoot, compile } = await fixture();
        await writeFile(path.join(uiRoot, 'vite.config.ts'), '// initial compiler configuration');
        const first = await compile();
        await writeFile(path.join(uiRoot, 'vite.config.ts'), '// changed compiler configuration');
        const second = await compile();
        expect(second.builds).toHaveLength(2);
        const original = first.manifests[0];
        const changed = second.manifests.find((manifest) => manifest.build_id !== original.build_id)!;
        expect(Object.keys(changed.assets)).not.toEqual(Object.keys(original.assets));
    });

    it('records final dynamic-import preload output and its updated map', async () => {
        const { uiRoot, artifactDir, publicDir, compile } = await fixture();
        await writeFile(path.join(uiRoot, 'lazy.js'), 'export const fail = () => { throw new Error("Lazy failure"); };');
        await writeFile(path.join(uiRoot, 'main.js'), 'window.loadedBuild = __SHIFT_UI_BUILD_ID__; window.load = () => import("./lazy.js");');
        const { manifests } = await compile();
        for (const [name, asset] of Object.entries(manifests[0].assets)) {
            const shipped = await readFile(path.join(publicDir, name));
            expect(sha256(shipped)).toBe(asset.sha256);
            expect(await readFile(path.join(artifactDir, manifests[0].build_id, name))).toEqual(shipped);
        }
    });

    it('rejects public and symlinked-public artifact destinations', async () => {
        const { directory, publicDir } = await fixture();
        await mkdir(publicDir, { recursive: true });
        expect(() => assertPrivateDirectory(path.join(publicDir, 'maps'), [publicDir])).toThrow('outside public');
        const alias = path.join(directory, 'alias');
        await symlink(publicDir, alias);
        expect(() => assertPrivateDirectory(path.join(alias, 'maps'), [publicDir])).toThrow('outside public');
    });

    it('keeps dependency and unrelated machine paths out of first-party source labels', () => {
        expect(canonicalSourceLabel('/machine/sdk/ui/node_modules/vue/index.js', '/machine/out/main.js.map', '/machine/sdk/ui', '/machine/portal/resources/js'))
            .toBe('dependencies/vue/index.js');
        expect(canonicalSourceLabel('/Users/private-user/elsewhere/utility.js', '/machine/out/main.js.map', '/machine/sdk/ui', '/machine/portal/resources/js'))
            .toBe('external/utility.js');
        expect(canonicalSourceLabel('/machine/portal/resources/js/components/Task.vue', '/machine/out/main.js.map', '/machine/sdk/ui', '/machine/portal/resources/js'))
            .toBe('portal/resources/js/components/Task.vue');
    });

    it('includes exact output and provenance in canonical identities', () => {
        const first = canonicalBuildId({ 'assets/main.js': 'a' }, provenance);
        expect(canonicalBuildId({ 'assets/main.js': 'b' }, provenance)).not.toBe(first);
        expect(canonicalBuildId({ 'assets/main.js': 'a' }, { ...provenance, sdk_revision: 'f'.repeat(40) })).not.toBe(first);
    });

    it('refuses to replace an existing build with mismatched private contents', async () => {
        const { artifactDir } = await fixture();
        const code = 'exact output';
        const map = '{}';
        const manifest: PrivateManifest = { schema_version: 1, build_id: 'a'.repeat(64), ...provenance,
            assets: { 'assets/main.js': { sha256: sha256(code), map: 'assets/main.js.map', map_sha256: sha256(map) } } };
        storePrivateArtifacts(artifactDir, manifest, { 'assets/main.js': { code, map } });
        await writeFile(path.join(artifactDir, manifest.build_id, 'assets/main.js'), 'tampered');
        const receiptBefore = await readFile(path.join(artifactDir, 'latest.json'), 'utf8');
        expect(() => storePrivateArtifacts(artifactDir, manifest, { 'assets/main.js': { code, map } })).toThrow('integrity');
        expect(await readFile(path.join(artifactDir, 'latest.json'), 'utf8')).toBe(receiptBefore);
    });
});
