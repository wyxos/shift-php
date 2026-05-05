#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import semver from 'semver';
import inquirer from 'inquirer';
import simpleGit from 'simple-git';
import { execa } from 'execa';

const PACKAGE_DIR = path.resolve('.');
const COMPOSER_PATH = path.join(PACKAGE_DIR, 'composer.json');
const UI_PATH = path.join(PACKAGE_DIR, './ui');
const git = simpleGit();

function getArgValue(flag) {
    const idx = process.argv.indexOf(flag);
    if (idx !== -1 && process.argv[idx + 1]) {
        return process.argv[idx + 1];
    }
    const prefixed = process.argv.find(a => a.startsWith(`${flag}=`));
    if (prefixed) {
        return prefixed.split('=').slice(1).join('=');
    }
    return null;
}

async function getCurrentVersion() {
    const { stdout } = await execa('git', ['tag', '--list', '--merged', 'HEAD'], { cwd: PACKAGE_DIR });
    const versions = stdout
        .split(/\r?\n/)
        .map(tag => tag.replace(/^v/, ''))
        .filter(version => semver.valid(version))
        .sort(semver.rcompare);

    return versions[0] || '0.0.0';
}

function calculateNextPatch(version) {
    return semver.inc(version, 'patch');
}

async function removeVersionFromComposer() {
    const composer = await fs.readJson(COMPOSER_PATH);
    delete composer.version;
    await fs.writeJson(COMPOSER_PATH, composer, { spaces: 2 });
}

async function hasChanges() {
    const { stdout } = await execa('git', ['status', '--porcelain'], { cwd: PACKAGE_DIR });

    return stdout.trim().length > 0;
}

async function main() {
    try {
        const currentVersion = await getCurrentVersion();
        const suggestedVersion = calculateNextPatch(currentVersion);

        // Support non-interactive mode via CLI arg or env var
        const cliVersion = getArgValue('--version') || getArgValue('-v') || process.env.RELEASE_VERSION;
        let version = cliVersion;

        if (version) {
            if (!semver.valid(version)) {
                throw new Error(`Invalid version provided: ${version}`);
            }
            console.log(`Using provided version: ${version}`);
        } else {
            const answers = await inquirer.prompt([
                {
                    name: 'version',
                    message: `Enter version to release (current: ${currentVersion})`,
                    default: suggestedVersion,
                    validate: input => semver.valid(input) ? true : 'Must be a valid semver (e.g., 1.0.0)',
                },
            ]);
            version = answers.version;
        }

        console.log(`🚀 Releasing version ${version}`);

        // Step 1: Keep package version authority in Git tags.
        await removeVersionFromComposer();

        // Step 2: Build frontend assets
        console.log('📦 Installing and building frontend...');
        await execa('npm', ['install'], { cwd: UI_PATH, stdio: 'inherit' });
        await execa('npm', ['run', 'build'], { cwd: UI_PATH, stdio: 'inherit' });

        // Step 3: Git commit, tag, push
        console.log('🔧 Staging files...');
        await git.add('.');

        if (await hasChanges()) {
            console.log('✅ Committing release...');
            await git.commit(`Release v${version}`);
        } else {
            console.log('✅ No release file changes to commit. Tagging current HEAD.');
        }

        console.log('🏷️ Tagging...');
        await git.addTag(`v${version}`);

        console.log('📤 Pushing...');
        await git.push('origin', 'HEAD');
        await git.pushTags();

        console.log('🎉 Release complete!');
    } catch (err) {
        console.error('❌ Release failed:', err.message);
        process.exit(1);
    }
}

main();
