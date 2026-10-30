import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { execa } from 'execa';
import { releaseArtifact } from '../scripts/source-map-release-artifact.mjs';
import { loadTargets, registerSourceMaps } from '../scripts/source-map-release.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
async function fixture(t) {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'shift-release-artifact-')));
    t.after(() => rm(root, { recursive: true, force: true }));
    const id = 'a'.repeat(64);
    const artifact = path.join(root, '.build/shift-ui', id);
    const publicRoot = path.join(root, 'public/shift-assets');
    await mkdir(path.join(artifact, 'assets'), { recursive: true });
    await mkdir(path.join(publicRoot, 'assets'), { recursive: true });
    const code = 'const build = "' + id + '";';
    const map = JSON.stringify({ version: 3, file: 'app.js', sources: ['sdk/main.js'], names: [], sourcesContent: ['throw new Error("test")'], mappings: 'AAAA' });
    const manifest = { schema_version: 1, build_id: id, sdk_revision: null, assets: { 'assets/app.js': { sha256: digest(code), map: 'assets/app.js.map', map_sha256: digest(map) } } };
    await writeFile(path.join(artifact, 'manifest.json'), JSON.stringify(manifest));
    await writeFile(path.join(artifact, 'assets/app.js'), code);
    await writeFile(path.join(artifact, 'assets/app.js.map'), map);
    await writeFile(path.join(publicRoot, 'assets/app.js'), code);
    await writeFile(path.join(root, '.build/shift-ui/latest.json'), JSON.stringify({ schema_version: 1, build_id: id }));
    return { root, artifact, publicRoot, id, manifest };
}

test('loads only the exact private artifact matching published JavaScript', async t => {
    const f = await fixture(t);
    await writeFile(path.join(f.artifact, 'unrelated-secret.txt'), 'must not transfer');
    const result = await releaseArtifact(f.root);
    assert.equal(result.buildId, f.id);
    assert.equal(result.assetsCount, 1);
    assert.deepEqual(result.files.map(item => item.relative), ['manifest.json', 'assets/app.js', 'assets/app.js.map']);
    assert.equal(result.manifestDigest, digest(await readFile(path.join(f.artifact, 'manifest.json'))));
});

for (const mutation of ['published', 'map', 'receipt', 'traversal', 'symlink', 'extra-public-script', 'public-map']) {
    test(`rejects ${mutation} artifact mismatches before registration`, async t => {
        const f = await fixture(t);
        if (mutation === 'extra-public-script') await writeFile(path.join(f.publicRoot, 'assets/stale.js'), 'unregistered script');
        if (mutation === 'public-map') await writeFile(path.join(f.publicRoot, 'assets/app.js.map'), 'private source map');
        if (mutation === 'published') await writeFile(path.join(f.publicRoot, 'assets/app.js'), 'old browser script');
        if (mutation === 'map') await writeFile(path.join(f.artifact, 'assets/app.js.map'), 'corrupted map');
        if (mutation === 'receipt') await writeFile(path.join(f.root, '.build/shift-ui/latest.json'), JSON.stringify({ schema_version: 1, build_id: '../bad' }));
        if (mutation === 'traversal') {
            f.manifest.assets['../private.js'] = f.manifest.assets['assets/app.js'];
            await writeFile(path.join(f.artifact, 'manifest.json'), JSON.stringify(f.manifest));
        }
        if (mutation === 'symlink') {
            await rm(path.join(f.artifact, 'assets/app.js'));
            await symlink(path.join(f.publicRoot, 'assets/app.js'), path.join(f.artifact, 'assets/app.js'));
        }
        await assert.rejects(releaseArtifact(f.root));
    });
}

test('requires explicit non-empty target configuration without accepting shell host options', async t => {
    const f = await fixture(t);
    const file = path.join(f.root, 'targets.json');
    await assert.rejects(loadTargets(file), /Configure/);
    for (const config of [null, { schema_version: 1, targets: [] }, { schema_version: 1, targets: [{ name: 'Bad', transport: 'ssh', host: '-oProxyCommand=bad', projectPath: '/app' }] }]) {
        await writeFile(file, JSON.stringify(config));
        await assert.rejects(loadTargets(file));
    }
    await writeFile(file, JSON.stringify({ schema_version: 1, targets: [{ name: 'Fixture', transport: 'local', projectPath: f.root }] }));
    assert.equal((await loadTargets(file))[0].php, 'php');
});

test('local registration verifies every target and removes only its private staging copy', async t => {
    const f = await fixture(t);
    const artifact = await releaseArtifact(f.root);
    const receipt = { schema_version: 1, build_id: f.id, manifest_sha256: artifact.manifestDigest, assets_count: 1, verified: true };
    const calls = [];
    let staged;
    const targets = [{ name: 'One', transport: 'local', projectPath: f.root, php: 'php' }, { name: 'Two', transport: 'local', projectPath: f.root, php: 'php' }];
    const run = async (command, args) => {
        calls.push({ command, args });
        if (args[1] === 'shift:sdk-build:import') {
            staged = args[2];
            assert.equal((await readFile(path.join(staged, 'manifest.json'))).toString(), (await readFile(path.join(f.artifact, 'manifest.json'))).toString());
            await assert.rejects(readFile(path.join(staged, 'unrelated-secret.txt')));
        }
        return { stdout: JSON.stringify(receipt) };
    };
    const receipts = await registerSourceMaps(artifact, targets, { run, log: () => {} });
    assert.equal(receipts.length, 2);
    assert.equal(calls.length, 4);
    await assert.rejects(readFile(path.join(staged, 'manifest.json')));
    assert.equal((await releaseArtifact(f.root)).buildId, f.id);
});

test('a failed or mismatched receipt stops later targets and supports an idempotent retry', async t => {
    const f = await fixture(t);
    const artifact = await releaseArtifact(f.root);
    const target = { name: 'One', transport: 'local', projectPath: f.root, php: 'php' };
    let calls = 0;
    await assert.rejects(registerSourceMaps(artifact, [target, { ...target, name: 'Two' }], {
        run: async () => { calls++; return { stdout: JSON.stringify({ schema_version: 1, build_id: 'b'.repeat(64), verified: true }) }; }, log: () => {},
    }), /publication stopped/);
    assert.equal(calls, 1);
    const receipt = { schema_version: 1, build_id: f.id, manifest_sha256: artifact.manifestDigest, assets_count: 1, verified: true };
    assert.equal((await registerSourceMaps(artifact, [target], { run: async () => ({ stdout: JSON.stringify(receipt) }), log: () => {} })).length, 1);
});

test('SSH registration batches allowlisted files, quotes commands and cleans failed transfers', async t => {
    const f = await fixture(t);
    const artifact = await releaseArtifact(f.root);
    const target = { name: 'SSH fixture', transport: 'ssh', host: 'fixture-alias', projectPath: "/srv/app with'quote", php: '/usr/bin/php' };
    const receipt = { schema_version: 1, build_id: f.id, manifest_sha256: artifact.manifestDigest, assets_count: 1, verified: true };
    const calls = [];
    const run = async (command, args) => {
        calls.push({ command, args });
        const remote = args.at(-1);
        if (command === 'ssh' && remote.includes('mktemp')) return { stdout: '/tmp/shift-sdk-build.Fixture1\n' };
        return { stdout: command === 'ssh' && remote.includes('artisan') ? JSON.stringify(receipt) : '' };
    };
    await registerSourceMaps(artifact, [target], { run, log: () => {} });
    assert.equal(calls.filter(item => item.command === 'scp').length, 2);
    assert.equal(calls.find(item => item.command === 'ssh' && item.args.at(-1).includes('artisan')).args.at(-1).includes("'/srv/app with'\\''quote'"), true);
    assert.match(calls.at(-1).args.at(-1), /^rm -rf -- '\/tmp\/shift-sdk-build\.Fixture1'$/);
    calls.length = 0;
    await assert.rejects(registerSourceMaps(artifact, [target], { run: async (command, args) => {
        calls.push({ command, args });
        if (args.at(-1).includes('mktemp')) return { stdout: '/tmp/shift-sdk-build.Fixture2' };
        if (command === 'scp') throw new Error('simulated disconnect');
        return { stdout: '' };
    }, log: () => {} }), /publication stopped/);
    assert.match(calls.at(-1).args.at(-1), /^rm -rf -- '\/tmp\/shift-sdk-build\.Fixture2'$/);
});


test('remote allocation trap removes its directory when setup fails before returning a path', async t => {
    const f = await fixture(t);
    const artifact = await releaseArtifact(f.root);
    const remote = await mkdtemp('/tmp/shift-sdk-build.');
    t.after(() => rm(remote, { recursive: true, force: true }));
    const bin = path.join(f.root, 'bin');
    await mkdir(bin);
    await writeFile(path.join(bin, 'mktemp'), '#!/bin/sh\nprintf \'%s\\n\' "$SDK_TEST_REMOTE"\n', { mode: 0o700 });
    await writeFile(path.join(bin, 'mkdir'), '#!/bin/sh\nexit 1\n', { mode: 0o700 });
    const target = { name: 'SSH fixture', transport: 'ssh', host: 'fixture-alias', projectPath: '/app', php: 'php' };
    await assert.rejects(registerSourceMaps(artifact, [target], { run: async (command, args) => {
        assert.equal(command, 'ssh');
        return execa('sh', ['-c', args.at(-1)], { env: { PATH: `${bin}:/usr/bin:/bin`, SDK_TEST_REMOTE: remote } });
    }, log: () => {} }), /publication stopped/);
    await assert.rejects(readFile(path.join(remote, 'anything')), /ENOENT/);
    await assert.rejects(realpath(remote), /ENOENT/);
});

test('remote cleanup failure retains the exact upload identity for recovery and blocks publication', async t => {
    const f = await fixture(t);
    const artifact = await releaseArtifact(f.root);
    const target = { name: 'SSH fixture', transport: 'ssh', host: 'fixture-alias', projectPath: '/app', php: 'php' };
    const receipt = { schema_version: 1, build_id: f.id, manifest_sha256: artifact.manifestDigest, assets_count: 1, verified: true };
    await assert.rejects(registerSourceMaps(artifact, [target], { run: async (command, args) => {
        const remote = args.at(-1);
        if (command === 'ssh' && remote.includes('mktemp')) return { stdout: '/tmp/shift-sdk-build.CleanupFailure' };
        if (command === 'ssh' && remote.startsWith('rm')) throw new Error('simulated disconnect');
        return { stdout: command === 'ssh' && remote.includes('artisan') ? JSON.stringify(receipt) : '' };
    }, log: () => {} }), /cleanup failed.*\/tmp\/shift-sdk-build\.CleanupFailure.*publication stopped/);
});


test('SSH cleanup waits for verification completion and preserves its safe failure stage', async t => {
    const f = await fixture(t);
    const artifact = await releaseArtifact(f.root);
    const target = { name: 'SSH fixture', transport: 'ssh', host: 'fixture-alias', projectPath: '/app', php: 'php' };
    const receipt = { schema_version: 1, build_id: f.id, manifest_sha256: artifact.manifestDigest, assets_count: 1, verified: true };
    let reached;
    const verificationStarted = new Promise(resolve => { reached = resolve; });
    let complete;
    const verification = new Promise(resolve => { complete = resolve; });
    let cleaned = false;
    const registration = registerSourceMaps(artifact, [target], { run: async (command, args) => {
        const remote = args.at(-1);
        if (command === 'ssh' && remote.includes('mktemp')) return { stdout: '/tmp/shift-sdk-build.Ordered' };
        if (command === 'ssh' && remote.includes('shift:sdk-build:verify')) { reached(); return verification; }
        if (command === 'ssh' && remote.startsWith('rm')) cleaned = true;
        return { stdout: command === 'ssh' && remote.includes('artisan') ? JSON.stringify(receipt) : '' };
    }, log: () => {} });
    await verificationStarted;
    assert.equal(cleaned, false);
    complete({ stdout: JSON.stringify({ ...receipt, verified: false }) });
    await assert.rejects(registration, /during verification.*publication stopped/);
    assert.equal(cleaned, true);
});
