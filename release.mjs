#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import semver from 'semver';
import inquirer from 'inquirer';
import { simpleGit } from 'simple-git';
import { execa } from 'execa';

const PACKAGE_DIR = fileURLToPath(new URL('.', import.meta.url));
const COMPOSER_PATH = path.join(PACKAGE_DIR, 'composer.json');
const UI_PATH = path.join(PACKAGE_DIR, 'ui');
const git = simpleGit(PACKAGE_DIR);

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
        } else if (arg === '--help' || arg === '-h') {
            options.help = true;
        } else {
            throw new Error(`Unknown release option: ${arg}`);
        }
    }
    options.version ??= env.RELEASE_VERSION || null;
    return options;
}

async function getCurrentVersion() {
    const { stdout } = await execa('git', ['tag', '--list', '--merged', 'HEAD'], { cwd: PACKAGE_DIR });
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

export async function hasReleaseChanges(currentVersion, run = execa) {
    const { stdout } = await run('git', ['status', '--porcelain'], { cwd: PACKAGE_DIR });
    if (stdout.trim() || currentVersion === '0.0.0') return true;
    const result = await run('git', ['diff', '--quiet', `v${currentVersion}`, 'HEAD', '--'], {
        cwd: PACKAGE_DIR, reject: false,
    });
    if (result.exitCode > 1) throw new Error('Unable to compare SDK contents with the latest release tag.');
    return result.exitCode === 1;
}

export async function main(options = parseOptions()) {
    if (options.help) {
        console.log('Usage: npm run release -- [--non-interactive] [--dry-run] [--version <exact-version>]');
        console.log('Default: Zephyr asks Codex to assess changes since the latest SDK release tag. --version bypasses assessment.');
        return;
    }
    const currentVersion = await getCurrentVersion();
    let version = options.version ? await chooseVersion(currentVersion, options) : null;
    const advisor = version ? null : await loadAdvisor();
    if (!options.dryRun) {
        console.log('📦 Installing and building frontend...');
        await execa('npm', ['ci'], { cwd: UI_PATH, stdio: 'inherit' });
        await execa('npm', ['run', 'build'], { cwd: UI_PATH, stdio: 'inherit' });
        await git.add('.');
    }
    if (!options.version && !await hasReleaseChanges(currentVersion)) {
        console.log(`No SDK changes since v${currentVersion}; skipping package release.`);
        return;
    }
    version ??= await chooseVersion(currentVersion, options, { loadVersionAdvisor: async () => advisor });
    if (options.dryRun) {
        console.log(`Dry run: would release v${version}; no files, commits, tags, or pushes changed.`);
        return;
    }
    const composer = await fs.readJson(COMPOSER_PATH);
    delete composer.version;
    await fs.writeJson(COMPOSER_PATH, composer, { spaces: 2 });
    await git.add('.');
    if ((await git.status()).files.length > 0) await git.commit(`Release v${version}`);
    const tagName = `v${version}`;
    await git.addTag(tagName);
    await git.push('origin', 'HEAD');
    await git.push('origin', `refs/tags/${tagName}`);
    console.log(`🎉 Release ${tagName} complete!`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch(error => { console.error('❌ Release failed:', error.message); process.exitCode = 1; });
}
