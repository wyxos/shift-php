import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseVersion, hasReleaseChanges, parseOptions } from '../release.mjs';

const silent = { nonInteractive: true, dryRun: true, version: null };

test('uses Zephyr minor advice rather than incrementing a large patch number', async () => {
    let context;
    const version = await chooseVersion('1.1.100', silent, {
        loadVersionAdvisor: async () => async options => { context = options; return 'minor'; },
        prompt: () => { throw new Error('Must not prompt in unattended mode'); },
    });
    assert.equal(version, '1.2.0');
    assert.equal(context.latestTag, 'v1.1.100');
    assert.equal(context.packageName, 'wyxos/shift-php');
});

test('uses major and patch advice without a hard-coded bump', async () => {
    for (const [bump, expected] of [['major', '2.0.0'], ['patch', '1.1.101']]) {
        assert.equal(await chooseVersion('1.1.100', silent, {
            loadVersionAdvisor: async () => async () => bump,
        }), expected);
    }
});

test('exact version overrides bypass automatic advice', async () => {
    assert.equal(await chooseVersion('1.1.100', { ...silent, version: '1.2.0' }, {
        loadVersionAdvisor: () => { throw new Error('Must not invoke adviser for an override'); },
    }), '1.2.0');
});

test('rejects repeated, older, malformed and unusable advised versions', async () => {
    for (const version of ['1.1.100', '1.1.99', 'minor']) {
        await assert.rejects(chooseVersion('1.1.100', { ...silent, version }), /greater than/);
    }
    await assert.rejects(chooseVersion('1.1.100', silent, {
        loadVersionAdvisor: async () => async () => 'invalid',
    }), /invalid release type/);
});

test('does not silently revert to patch when the Zephyr adviser cannot load', async () => {
    await assert.rejects(chooseVersion('1.1.100', silent, {
        loadVersionAdvisor: async () => { throw new Error('adviser unavailable'); },
    }), /adviser unavailable/);
});

test('interactive approval defaults to the advised version', async () => {
    let questions;
    const version = await chooseVersion('1.1.100', { ...silent, nonInteractive: false, dryRun: false }, {
        loadVersionAdvisor: async () => async () => 'minor',
        prompt: async items => { questions = items; return { version: '1.2.0' }; },
    });
    assert.equal(version, '1.2.0');
    assert.equal(questions[0].default, '1.2.0');
});

test('unattended and read-only options require no supplied version', () => {
    assert.deepEqual(parseOptions(['--non-interactive', '--dry-run'], {}), {
        version: null, nonInteractive: true, dryRun: true, help: false,
    });
    assert.equal(parseOptions(['--version=1.2.0'], {}).version, '1.2.0');
    assert.equal(parseOptions([], { RELEASE_VERSION: '1.2.0' }).version, '1.2.0');
    assert.throws(() => parseOptions(['--version'], {}), /requires/);
    assert.throws(() => parseOptions(['--unknown'], {}), /Unknown/);
});

test('normalizes version overrides before constructing the Git tag', async () => {
    assert.equal(await chooseVersion('1.1.100', { ...silent, version: 'v1.2.0' }), '1.2.0');
});

test('does not automatically release identical SDK contents again', async () => {
    const equal = async (_command, args) => args[0] === 'status' ? { stdout: '' } : { exitCode: 0 };
    assert.equal(await hasReleaseChanges('1.1.100', equal), false);
    assert.equal(await hasReleaseChanges('1.1.100', async () => ({ stdout: ' M release.mjs' })), true);
    const different = async (_command, args) => args[0] === 'status' ? { stdout: '' } : { exitCode: 1 };
    assert.equal(await hasReleaseChanges('1.1.100', different), true);
    const failed = async (_command, args) => args[0] === 'status' ? { stdout: '' } : { exitCode: 128 };
    await assert.rejects(hasReleaseChanges('1.1.100', failed), /Unable to compare/);
});
