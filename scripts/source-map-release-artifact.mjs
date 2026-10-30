import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';

const idPattern = /^[a-f0-9]{64}$/;
const validId = value => typeof value === 'string' && value.length === 64 && idPattern.test(value);
const assetPattern = /^assets\/[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*\.js$/;
const digest = value => createHash('sha256').update(value).digest('hex');

async function file(root, relative, limit) {
    const candidate = path.join(root, relative);
    const stat = await lstat(candidate);
    const actual = await realpath(candidate);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > limit || actual !== candidate) {
        throw new Error('SDK source-map artifact contains an unsafe or oversized file.');
    }
    return readFile(candidate);
}

async function publishedJavaScript(root) {
    const pending = [''];
    const scripts = [];
    let count = 0;
    while (pending.length) {
        const relative = pending.pop();
        for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
            if (++count > 1000 || entry.isSymbolicLink()) throw new Error('SDK public assets contain unsafe or excessive files.');
            const name = path.posix.join(relative, entry.name);
            if (entry.isDirectory()) pending.push(name);
            else if (name.endsWith('.map')) throw new Error('SDK private source maps must not be published.');
            else if (name.endsWith('.js')) scripts.push(name);
        }
    }
    return scripts.sort();
}

export async function releaseArtifact(packageDirectory) {
    packageDirectory = await realpath(packageDirectory);
    const privateRoot = path.join(packageDirectory, '.build/shift-ui');
    const receipt = JSON.parse((await file(privateRoot, 'latest.json', 1024)).toString());
    if (receipt.schema_version !== 1 || !validId(receipt.build_id)) {
        throw new Error('SDK UI build did not produce a valid source-map receipt.');
    }
    const root = path.join(privateRoot, receipt.build_id);
    if ((await lstat(root)).isSymbolicLink() || await realpath(root) !== root) throw new Error('Unsafe SDK build artifact directory.');
    const manifestBytes = await file(root, 'manifest.json', 1_000_000);
    const manifest = JSON.parse(manifestBytes.toString());
    if (manifest.schema_version !== 1 || manifest.build_id !== receipt.build_id || !manifest.assets || Array.isArray(manifest.assets)) {
        throw new Error('SDK UI build receipt does not match its private manifest.');
    }
    const entries = Object.entries(manifest.assets);
    if (entries.length < 1 || entries.length > 100) throw new Error('Invalid SDK source-map asset count.');
    const publicRoot = path.join(packageDirectory, 'public/shift-assets');
    const publicScripts = await publishedJavaScript(publicRoot);
    if (JSON.stringify(publicScripts) !== JSON.stringify(entries.map(([name]) => name).sort())) {
        throw new Error('Published SDK JavaScript does not match the registered build asset list.');
    }
    const files = [{ relative: 'manifest.json', bytes: manifestBytes }];
    let totalBytes = manifestBytes.length;
    for (const [name, attributes] of entries) {
        if ((!assetPattern.test(name) || !name.endsWith('.js') || name.length > 255) || attributes?.map !== `${name}.map`
            || !validId(attributes.sha256) || !validId(attributes.map_sha256)) {
            throw new Error('Invalid SDK source-map manifest asset.');
        }
        const code = await file(root, name, 16_000_000);
        const map = await file(root, attributes.map, 32_000_000);
        const published = await file(publicRoot, name, 16_000_000);
        totalBytes += code.length + map.length;
        if (totalBytes > 128_000_000 || digest(code) !== attributes.sha256 || digest(published) !== attributes.sha256
            || digest(map) !== attributes.map_sha256) {
            throw new Error('Private SDK source maps do not match the JavaScript being released.');
        }
        files.push({ relative: name, bytes: code }, { relative: attributes.map, bytes: map });
    }
    return {
        buildId: manifest.build_id,
        manifestDigest: digest(manifestBytes),
        assetsCount: entries.length,
        root,
        files,
    };
}
