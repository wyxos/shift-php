import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { OutputBundle, OutputChunk } from 'rollup';
import type { Plugin, ResolvedConfig } from 'vite';
import {
    assertPrivateDirectory, BUILD_PLACEHOLDER, canonicalBuildId, sha256, storePrivateArtifacts,
    type BuildProvenance, type PrivateAsset, type PrivateManifest,
} from './sdk-artifact-store';

type BuildOptions = {
    uiRoot: string;
    portalResources: string;
    artifactDirectory?: string;
};

function revision(directory: string): { revision: string | null; dirty: boolean | null } {
    try {
        const revision = execFileSync('git', ['-C', directory, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        if (!/^[a-f0-9]{40}$/.test(revision)) return { revision: null, dirty: null };
        const dirty = execFileSync('git', ['-C', directory, 'status', '--porcelain'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() !== '';
        return { revision, dirty };
    } catch {
        return { revision: null, dirty: null };
    }
}

function assetText(value: string | Uint8Array): string {
    return typeof value === 'string' ? value : Buffer.from(value).toString('utf8');
}

export function canonicalSourceLabel(source: string, sourcemapPath: string, uiRoot: string, portalResources: string): string {
    const absolute = path.resolve(path.dirname(sourcemapPath), source);
    const normalized = absolute.replaceAll('\\', '/');
    const dependency = normalized.lastIndexOf('/node_modules/');
    if (dependency !== -1) return 'dependencies/' + normalized.slice(dependency + 14);
    if (absolute.startsWith(uiRoot + path.sep)) return `sdk/ui/${path.relative(uiRoot, absolute).replaceAll('\\', '/')}`;
    if (absolute.startsWith(portalResources + path.sep)) return `portal/resources/js/${path.relative(portalResources, absolute).replaceAll('\\', '/')}`;
    const filename = path.basename(absolute).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 180);
    return 'external/' + (filename && filename !== '.' && filename !== '..' ? filename : 'unknown');
}

export function sdkArtifacts(options: BuildOptions): Plugin[] {
    const packageRoot = path.resolve(options.uiRoot, '..');
    const portalRoot = path.resolve(options.portalResources, '../..');
    const artifactDirectory = options.artifactDirectory ?? path.join(packageRoot, '.build/shift-ui');
    const modules = new Map<string, string>();
    let config: ResolvedConfig;
    let provenance: BuildProvenance;
    let inputFingerprint = '';
    let manifest: PrivateManifest | null = null;
    let privateAssets: Record<string, PrivateAsset> = {};
    const normalize = (value: string): string => value.replaceAll('\\', '/')
        .replaceAll(options.uiRoot.replaceAll('\\', '/'), 'sdk/ui')
        .replaceAll(options.portalResources.replaceAll('\\', '/'), 'portal/resources/js');
    const fingerprint = (): string => {
        if (inputFingerprint) return inputFingerprint;
        const lock = readFileSync(path.join(options.uiRoot, 'package-lock.json'), 'utf8');
        inputFingerprint = sha256(JSON.stringify({
            provenance,
            modules: [...modules].sort(([first], [second]) => first < second ? -1 : first > second ? 1 : 0),
            lock: sha256(lock), mode: config.mode,
            compiler_files: ['vite.config.ts', 'build/sdk-artifacts.ts', 'build/sdk-artifact-store.ts', 'package.json']
                .filter((file) => existsSync(path.join(options.uiRoot, file)))
                .map((file) => [file, sha256(readFileSync(path.join(options.uiRoot, file)))]),
            compiler: { target: config.build.target, minify: config.build.minify, cssTarget: config.build.cssTarget },
            defines: config.define,
        }));
        return inputFingerprint;
    };
    const sourceLabel = (source: string, sourcemapPath: string): string => canonicalSourceLabel(source, sourcemapPath, options.uiRoot, options.portalResources);
    return [
        {
            name: 'shift-sdk-build-inputs', enforce: 'pre', apply: 'build',
            configResolved(resolved) {
                config = resolved;
                const sdk = revision(packageRoot);
                const portal = revision(portalRoot);
                provenance = { sdk_revision: sdk.revision, sdk_dirty: sdk.dirty, portal_revision: portal.revision, portal_dirty: portal.dirty };
            },
            transform(code, id) {
                modules.set(normalize(id), sha256(normalize(code)));
                return null;
            },
            augmentChunkHash() { return fingerprint(); },
        },
        {
            name: 'shift-sdk-private-artifacts', enforce: 'post', apply: 'build',
            config() {
                return {
                    define: { __SHIFT_UI_BUILD_ID__: JSON.stringify(BUILD_PLACEHOLDER), __SHIFT_UI_SDK_REVISION__: JSON.stringify(revision(packageRoot).revision) },
                    build: { sourcemap: 'hidden', rollupOptions: { output: { sourcemapPathTransform: sourceLabel } } },
                };
            },
            configResolved(resolved) {
                assertPrivateDirectory(artifactDirectory, [path.join(packageRoot, 'public'), path.resolve(resolved.root, resolved.build.outDir)]);
                if (resolved.build.sourcemap !== 'hidden') throw new Error('SHIFT builds require private hidden source maps.');
            },
            generateBundle: {
                order: 'post',
                handler(_output, bundle) {
                const outputs: Record<string, string> = {};
                for (const [name, item] of Object.entries(bundle)) {
                    if (item.type === 'chunk') outputs[name] = item.code;
                    else if (name.endsWith('.map') || name.endsWith('.css')) outputs[name] = assetText(item.source);
                }
                const buildId = canonicalBuildId(outputs, provenance);
                if (BUILD_PLACEHOLDER.length !== buildId.length) throw new Error('SHIFT build identifiers must preserve source-map positions.');
                privateAssets = {};
                const assets: PrivateManifest['assets'] = {};
                for (const [name, item] of Object.entries(bundle)) {
                    if (item.type !== 'chunk' || !name.endsWith('.js')) continue;
                    item.code = item.code.replaceAll(BUILD_PLACEHOLDER, buildId);
                    const mapAsset = bundle[`${name}.map`];
                    if (!mapAsset || mapAsset.type !== 'asset') throw new Error(`Missing private source map for ${name}.`);
                    const map = assetText(mapAsset.source);
                    assets[name] = { sha256: sha256(item.code), map: `${name}.map`, map_sha256: sha256(map) };
                    privateAssets[name] = { code: item.code, map };
                }
                for (const name of Object.keys(bundle)) if (name.endsWith('.map')) delete bundle[name];
                manifest = { schema_version: 1, build_id: buildId, ...provenance, assets };
                },
            },
            writeBundle(_output, bundle: OutputBundle) {
                if (!manifest) throw new Error('Missing SHIFT frontend build manifest.');
                for (const [name, item] of Object.entries(manifest.assets)) {
                    const chunk = bundle[name] as OutputChunk | undefined;
                    if (chunk?.type !== 'chunk' || sha256(chunk.code) !== item.sha256) throw new Error('SHIFT output changed after its build identity was recorded.');
                }
                storePrivateArtifacts(artifactDirectory, manifest, privateAssets);
                this.info(`Private SHIFT source maps: ${path.join(artifactDirectory, manifest.build_id)}`);
            },
        },
    ];
}
