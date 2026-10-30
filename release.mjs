#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import semver from 'semver';
import inquirer from 'inquirer';
import { simpleGit } from 'simple-git';
import { execa } from 'execa';
import { loadTargets, registrationPlan, registerSourceMaps } from './scripts/source-map-release.mjs';
import { releaseArtifact } from './scripts/source-map-release-artifact.mjs';

const PACKAGE_DIR = fileURLToPath(new URL('.', import.meta.url));
const COMPOSER_PATH = path.join(PACKAGE_DIR, 'composer.json');

export function parseOptions(args = process.argv.slice(2), env = process.env) {
    const options = { version: null, nonInteractive: false, dryRun: false, help: false };
    for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        if (arg === '--version' || arg === '-v') {
            options.version = args[++index];
            if (!options.version || options.version.startsWith('-')) throw new Error('--version requires an exact version.');
        } else if (arg.startsWith('--version=')) {
            options.version = arg.slice('--version='.length);
            if (!options.version) throw new Error('--version requires an exact version.');
        } else if (arg === '--non-interactive') {
            options.nonInteractive = true;
        } else if (arg === '--dry-run') {
            options.dryRun = true;
        } else if (arg === '--register-source-maps') {
            options.registerSourceMaps = true;
        } else if (arg === '--source-map-targets') {
            options.sourceMapTargets = args[++index];
            if (!options.sourceMapTargets || options.sourceMapTargets.startsWith('-')) throw new Error('--source-map-targets requires a configuration file.');
        } else if (arg.startsWith('--source-map-targets=')) {
            options.sourceMapTargets = arg.slice('--source-map-targets='.length);
            if (!options.sourceMapTargets) throw new Error('--source-map-targets requires a configuration file.');
        } else if (arg === '--help' || arg === '-h') {
            options.help = true;
        } else {
            throw new Error(`Unknown release option: ${arg}`);
        }
    }
    options.version ??= env.RELEASE_VERSION || null;
    if (!options.sourceMapTargets && env.SHIFT_SDK_RELEASE_TARGETS_FILE) options.sourceMapTargets = env.SHIFT_SDK_RELEASE_TARGETS_FILE;
    if (options.registerSourceMaps && options.version) throw new Error('--register-source-maps cannot be combined with a release version.');
    return options;
}

async function getCurrentVersion(run = execa, packageDirectory = PACKAGE_DIR) {
    const { stdout } = await run('git', ['tag', '--list', '--merged', 'HEAD'], { cwd: packageDirectory });
    return stdout.split(/\r?\n/).map(tag => tag.replace(/^v/, ''))
        .filter(version => semver.valid(version)).sort(semver.rcompare)[0] || '0.0.0';
}

async function loadAdvisor() {
    try {
        return (await import('@wyxos/zephyr/release-advisor')).recommendReleaseType;
    } catch (error) {
        throw new Error('Install a Zephyr version exposing @wyxos/zephyr/release-advisor before automatic SDK releases.', { cause: error });
    }
}

export async function chooseVersion(currentVersion, options, { loadVersionAdvisor = loadAdvisor, prompt = inquirer.prompt } = {}) {
    let version = options.version;
    if (!version) {
        const advisor = await loadVersionAdvisor();
        const composer = await fs.readJson(COMPOSER_PATH);
        const bump = await advisor({
            currentVersion,
            packageName: composer.name,
            rootDir: PACKAGE_DIR,
            latestTag: currentVersion === '0.0.0' ? null : `v${currentVersion}`,
            logStep: message => console.log(`→ ${message}`),
            logWarning: message => console.warn(`⚠ ${message}`),
        });
        version = semver.inc(currentVersion, bump);
        if (!version) throw new Error(`Zephyr returned an invalid release type: ${bump}`);
        console.log(`Zephyr recommends ${bump}: ${currentVersion} -> ${version}`);
        if (!options.nonInteractive && !options.dryRun) {
            ({ version } = await prompt([{
                name: 'version', message: 'Version to release', default: version,
                validate: input => semver.valid(input) && semver.gt(input, currentVersion)
                    ? true : `Must be a valid version greater than ${currentVersion}.`,
            }]));
        }
    } else {
        console.log(`Using explicit version override: ${version}`);
    }
    const normalizedVersion = semver.valid(version);
    if (!normalizedVersion || !semver.gt(normalizedVersion, currentVersion)) {
        throw new Error(`Release version must be valid and greater than ${currentVersion}: ${version}`);
    }
    return normalizedVersion;
}

export async function hasReleaseChanges(currentVersion, run = execa, packageDirectory = PACKAGE_DIR) {
    const { stdout } = await run('git', ['status', '--porcelain'], { cwd: packageDirectory });
    if (stdout.trim() || currentVersion === '0.0.0') return true;
    const result = await run('git', ['diff', '--quiet', `v${currentVersion}`, 'HEAD', '--'], {
        cwd: packageDirectory, reject: false,
    });
    if (result.exitCode > 1) throw new Error('Unable to compare SDK contents with the latest release tag.');
    return result.exitCode === 1;
}

export async function main(options = parseOptions(), dependencies = {}) {
    const packageDirectory = dependencies.packageDirectory ?? PACKAGE_DIR;
    const run = dependencies.run ?? execa;
    const releaseGit = dependencies.git ?? simpleGit(packageDirectory);
    const output = dependencies.log ?? console.log;
    const targetsLoader = dependencies.loadTargets ?? loadTargets;
    const artifactLoader = dependencies.releaseArtifact ?? releaseArtifact;
    const register = dependencies.registerSourceMaps ?? registerSourceMaps;
    if (options.help) {
        output('Usage: npm run release -- [--non-interactive] [--dry-run] [--version <exact-version>] [--source-map-targets <file>]');
        output('Retry registration only: npm run release -- --register-source-maps [--dry-run]');
        output('Every SDK release verifies its private source maps on all configured SHIFT targets before creating or pushing a release.');
        output('Default: Zephyr asks Codex to assess changes since the latest SDK release tag. --version bypasses assessment.');
        return;
    }
    const targets = await targetsLoader(path.resolve(packageDirectory, options.sourceMapTargets ?? '.shift-sdk-release.json'));
    const showPlan = artifact => {
        for (const item of registrationPlan(targets, artifact)) output(`Source maps: ${item.name} (${item.transport}), build ${item.build_id}`);
    };
    if (options.registerSourceMaps) {
        const artifact = await artifactLoader(packageDirectory);
        showPlan(artifact);
        if (options.dryRun) {
            output('Dry run: no registration, connections, builds or Git changes performed.');
            return;
        }
        await register(artifact, targets, { run, log: output });
        output(`SDK source maps registered and verified for build ${artifact.buildId}. No package release performed.`);
        return;
    }
    const currentVersion = await (dependencies.getCurrentVersion ?? getCurrentVersion)(run, packageDirectory);
    if (!options.version && !await (dependencies.hasReleaseChanges ?? hasReleaseChanges)(currentVersion, run, packageDirectory)) {
        output(`No SDK changes since v${currentVersion}; skipping package release.`);
        return;
    }
    const versionChooser = dependencies.chooseVersion ?? chooseVersion;
    const version = await versionChooser(currentVersion, options);
    showPlan(null);
    if (options.dryRun) {
        output(`Dry run: would build, verify source maps on every target, then release v${version}; no connections, files, commits, tags, or pushes changed.`);
        return;
    }
    const uiPath = path.join(packageDirectory, 'ui');
    const latestReceipt = path.join(packageDirectory, '.build/shift-ui/latest.json');
    await fs.remove(latestReceipt);
    output('📦 Installing and building frontend...');
    const buildOptions = {
        cwd: uiPath,
        stdio: 'inherit',
        env: {
            SHIFT_UI_PUBLIC_DIR: path.join(packageDirectory, 'public/shift-assets'),
            SHIFT_UI_ARTIFACT_DIR: path.join(packageDirectory, '.build/shift-ui'),
        },
    };
    await run('npm', ['ci'], buildOptions);
    await run('npm', ['run', 'build'], buildOptions);
    const artifact = await artifactLoader(packageDirectory);
    await register(artifact, targets, { run, log: output });
    const composerPath = path.join(packageDirectory, 'composer.json');
    const composer = await fs.readJson(composerPath);
    delete composer.version;
    await fs.writeJson(composerPath, composer, { spaces: 2 });
    await releaseGit.add('.');
    if ((await releaseGit.status()).files.length > 0) await releaseGit.commit(`Release v${version}`);
    let publishedArtifact;
    try { publishedArtifact = await artifactLoader(packageDirectory); } catch (cause) {
        throw new Error('SDK published artifacts became invalid after registration; publication stopped before tag or push.', { cause });
    }
    if (publishedArtifact.buildId !== artifact.buildId || publishedArtifact.manifestDigest !== artifact.manifestDigest
        || publishedArtifact.assetsCount !== artifact.assetsCount) {
        throw new Error('SDK build changed after source-map registration; publication stopped before tag or push.');
    }
    const tagName = `v${version}`;
    await releaseGit.addTag(tagName);
    await releaseGit.push('origin', 'HEAD');
    await releaseGit.push('origin', `refs/tags/${tagName}`);
    output(`🎉 Release ${tagName} complete; SDK source maps verified on every target.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch(error => { console.error('❌ Release failed:', error.message); process.exitCode = 1; });
}
