import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { main, parseOptions, hasReleaseChanges } from '../release.mjs';

async function flow(t, overrides = {}) {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'shift-release-flow-')));
    t.after(() => rm(root, { recursive: true, force: true }));
    await mkdir(path.join(root, 'ui'));
    await mkdir(path.join(root, '.build/shift-ui'), { recursive: true });
    await writeFile(path.join(root, 'composer.json'), JSON.stringify({ name: 'fixture/sdk', version: '1.0.0' }));
    const latest = path.join(root, '.build/shift-ui/latest.json');
    await writeFile(latest, 'stale build receipt');
    const events = [];
    const targets = [{ name: 'One', transport: 'local', projectPath: root, php: 'php' }, { name: 'Two', transport: 'local', projectPath: root, php: 'php' }];
    const artifact = { buildId: 'a'.repeat(64) };
    const git = Object.fromEntries(['add', 'status', 'commit', 'addTag', 'push'].map(name => [name, async (...args) => {
        events.push(`git:${name}:${args.join(':')}`);
        return name === 'status' ? { files: [{ path: 'fixture' }] } : undefined;
    }]));
    const deps = {
        packageDirectory: root,
        git,
        log: () => {},
        loadTargets: async () => { events.push('targets'); return targets; },
        getCurrentVersion: async () => { events.push('version'); return '1.0.0'; },
        hasReleaseChanges: async () => { events.push('changes'); return true; },
        chooseVersion: async () => { events.push('advice'); return '1.0.1'; },
        run: async (command, args, options) => {
            events.push(`${command}:${args.join(':')}`);
            assert.equal(options.env.SHIFT_UI_PUBLIC_DIR, path.join(root, 'public/shift-assets'));
            assert.equal(options.env.SHIFT_UI_ARTIFACT_DIR, path.join(root, '.build/shift-ui'));
            if (args[0] === 'ci') await assert.rejects(readFile(latest), /ENOENT/);
            if (args[0] === 'run') await writeFile(latest, 'fresh build receipt');
            return { stdout: '' };
        },
        releaseArtifact: async () => {
            events.push('artifact');
            assert.equal(await readFile(latest, 'utf8'), 'fresh build receipt');
            return artifact;
        },
        registerSourceMaps: async () => { events.push('registered:One'); events.push('registered:Two'); },
        ...overrides,
    };
    return { root, events, deps, latest, artifact };
}

const options = { version: null, nonInteractive: true, dryRun: false, help: false };

test('normal release registers every exact fresh build before staging, tagging or pushing', async t => {
    const f = await flow(t);
    await main(options, f.deps);
    assert.deepEqual(f.events, [
        'targets', 'version', 'changes', 'advice', 'npm:ci', 'npm:run:build', 'artifact',
        'registered:One', 'registered:Two', 'git:add:.', 'git:status:', 'git:commit:Release v1.0.1',
        'artifact', 'git:addTag:v1.0.1', 'git:push:origin:HEAD', 'git:push:origin:refs/tags/v1.0.1',
    ]);
    assert.equal(JSON.parse(await readFile(path.join(f.root, 'composer.json'))).version, undefined);
});

test('partial target failure leaves artifacts for retry and prevents every Git write', async t => {
    const f = await flow(t);
    f.deps.registerSourceMaps = async () => { f.events.push('registered:One'); throw new Error('Two not verified'); };
    await assert.rejects(main(options, f.deps), /Two not verified/);
    assert.equal(f.events.some(event => event.startsWith('git:')), false);
    assert.equal(await readFile(f.latest, 'utf8'), 'fresh build receipt');
    assert.equal(JSON.parse(await readFile(path.join(f.root, 'composer.json'))).version, '1.0.0');
});

test('normal dry run outlines every target without building, registering or changing files', async t => {
    const f = await flow(t);
    const lines = [];
    f.deps.log = message => lines.push(message);
    await main({ ...options, dryRun: true }, f.deps);
    assert.deepEqual(f.events, ['targets', 'version', 'changes', 'advice']);
    assert.equal(lines.filter(line => line.startsWith('Source maps:')).length, 2);
    assert.equal(await readFile(f.latest, 'utf8'), 'stale build receipt');
});

test('register-only retry reuses existing artifact without adviser, npm or Git commands', async t => {
    const f = await flow(t);
    f.deps.releaseArtifact = async () => { f.events.push('artifact'); return f.artifact; };
    await main({ ...options, registerSourceMaps: true }, f.deps);
    assert.deepEqual(f.events, ['targets', 'artifact', 'registered:One', 'registered:Two']);
    assert.equal(await readFile(f.latest, 'utf8'), 'stale build receipt');
});

test('register-only dry run validates an existing build but makes no connections or Git changes', async t => {
    const f = await flow(t);
    f.deps.releaseArtifact = async () => { f.events.push('artifact'); return f.artifact; };
    await main({ ...options, registerSourceMaps: true, dryRun: true }, f.deps);
    assert.deepEqual(f.events, ['targets', 'artifact']);
});

test('unchanged package exits before build and adviser to avoid provenance-induced release churn', async t => {
    const f = await flow(t);
    f.deps.hasReleaseChanges = async () => { f.events.push('changes'); return false; };
    await main(options, f.deps);
    assert.deepEqual(f.events, ['targets', 'version', 'changes']);
    assert.equal(await readFile(f.latest, 'utf8'), 'stale build receipt');
});

test('missing targets stop before even a build or release version lookup', async t => {
    const f = await flow(t);
    f.deps.loadTargets = async () => { throw new Error('No configured targets'); };
    await assert.rejects(main(options, f.deps), /No configured targets/);
    assert.deepEqual(f.events, []);
});

test('a build that does not write a fresh receipt cannot register or publish stale assets', async t => {
    const f = await flow(t);
    f.deps.run = async (command, args) => { f.events.push(`${command}:${args.join(':')}`); return { stdout: '' }; };
    f.deps.releaseArtifact = async () => { await readFile(f.latest); return f.artifact; };
    await assert.rejects(main(options, f.deps), /ENOENT/);
    assert.equal(f.events.some(event => event.startsWith('registered:') || event.startsWith('git:')), false);
});

test('new release flags are explicit and old option defaults remain compatible', () => {
    assert.deepEqual(parseOptions(['--register-source-maps', '--source-map-targets=fixture.json'], {}), { ...options, nonInteractive: false, registerSourceMaps: true, sourceMapTargets: 'fixture.json' });
    assert.equal(parseOptions([], { SHIFT_SDK_RELEASE_TARGETS_FILE: 'fixture.json' }).sourceMapTargets, 'fixture.json');
    assert.throws(() => parseOptions(['--source-map-targets'], {}), /requires/);
    assert.throws(() => parseOptions(['--register-source-maps', '--version=1.0.1'], {}), /cannot/);
});

test('source change checks use the selected package directory', async () => {
    const locations = [];
    await hasReleaseChanges('1.0.0', async (_command, _args, options) => { locations.push(options.cwd); return { stdout: '', exitCode: 0 }; }, '/isolated/package');
    assert.deepEqual(locations, ['/isolated/package', '/isolated/package']);
});


test('a commit hook cannot change registered artifacts and still tag or publish the release', async t => {
    const f = await flow(t);
    f.deps.git.commit = async () => {
        f.events.push('git:commit:mutating-hook');
        await writeFile(f.latest, 'different hook build receipt');
    };
    await assert.rejects(main(options, f.deps), /publication stopped before tag or push/);
    assert.equal(f.events.some(event => event.startsWith('git:addTag:') || event.startsWith('git:push:')), false);
});

test('a valid but different artifact selected after committing still blocks publication', async t => {
    const f = await flow(t);
    let calls = 0;
    f.deps.releaseArtifact = async () => ({ buildId: calls++ === 0 ? 'a'.repeat(64) : 'b'.repeat(64), manifestDigest: 'c'.repeat(64), assetsCount: 1 });
    await assert.rejects(main(options, f.deps), /SDK build changed.*before tag or push/);
    assert.equal(f.events.some(event => event.startsWith('git:addTag:') || event.startsWith('git:push:')), false);
});
