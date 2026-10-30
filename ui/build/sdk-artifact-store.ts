import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const BUILD_PLACEHOLDER = 'SHIFT_UI_BUILD_ID_PLACEHOLDER_'.padEnd(64, '0');

export type BuildProvenance = {
    sdk_revision: string | null;
    sdk_dirty: boolean | null;
    portal_revision: string | null;
    portal_dirty: boolean | null;
};
export type PrivateAsset = { code: string; map: string };
export type PrivateManifest = BuildProvenance & {
    schema_version: 1;
    build_id: string;
    assets: Record<string, { sha256: string; map: string; map_sha256: string }>;
};

export const sha256 = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');

export function canonicalBuildId(outputs: Record<string, string | Uint8Array>, provenance: BuildProvenance): string {
    const entries = Object.entries(outputs).sort(([first], [second]) => first < second ? -1 : first > second ? 1 : 0)
        .map(([name, content]) => [name, sha256(content)]);
    return sha256(JSON.stringify({ schema_version: 1, provenance, outputs: entries }));
}

function physicalPath(value: string): string {
    let existing = path.resolve(value);
    const suffix: string[] = [];
    while (!existsSync(existing)) {
        suffix.unshift(path.basename(existing));
        const parent = path.dirname(existing);
        if (parent === existing) break;
        existing = parent;
    }
    return path.join(realpathSync(existing), ...suffix);
}

export function assertPrivateDirectory(directory: string, publicDirectories: string[]): void {
    const destination = physicalPath(directory);
    for (const directory of publicDirectories) {
        const publicRoot = physicalPath(directory);
        if (destination === publicRoot || destination.startsWith(publicRoot + path.sep)) {
            throw new Error('SHIFT source maps must be stored outside public asset directories.');
        }
    }
}

export function storePrivateArtifacts(directory: string, manifest: PrivateManifest, assets: Record<string, PrivateAsset>): void {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const destination = path.join(directory, manifest.build_id);
    const manifestJson = JSON.stringify(manifest, null, 2) + '\n';
    const verifyExisting = (): void => {
        if (readFileSync(path.join(destination, 'manifest.json'), 'utf8') !== manifestJson) {
            throw new Error('An existing SHIFT build ID has different artifact metadata.');
        }
        for (const [name, asset] of Object.entries(manifest.assets)) {
            if (sha256(readFileSync(path.join(destination, name))) !== asset.sha256
                || sha256(readFileSync(path.join(destination, asset.map))) !== asset.map_sha256) {
                throw new Error('An existing SHIFT build artifact failed its integrity check.');
            }
        }
    };
    if (existsSync(destination)) {
        verifyExisting();
        return;
    }
    const temporary = mkdtempSync(path.join(directory, '.pending-'));
    try {
        for (const [name, asset] of Object.entries(assets)) {
            mkdirSync(path.dirname(path.join(temporary, name)), { recursive: true, mode: 0o700 });
            writeFileSync(path.join(temporary, name), asset.code, { mode: 0o600 });
            writeFileSync(path.join(temporary, `${name}.map`), asset.map, { mode: 0o600 });
        }
        writeFileSync(path.join(temporary, 'manifest.json'), manifestJson, { mode: 0o600 });
        try {
            renameSync(temporary, destination);
        } catch (error) {
            if (!existsSync(destination)) throw error;
            verifyExisting();
        }
    } finally {
        rmSync(temporary, { recursive: true, force: true });
    }
}
