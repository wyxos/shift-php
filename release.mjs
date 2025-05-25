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

async function getCurrentVersion() {
    const composer = await fs.readJson(COMPOSER_PATH);
    return composer.version || '0.0.0';
}

function calculateNextPatch(version) {
    return semver.inc(version, 'patch');
}

async function updateVersionInComposer(version) {
    const composer = await fs.readJson(COMPOSER_PATH);
    composer.version = version;
    await fs.writeJson(COMPOSER_PATH, composer, { spaces: 2 });
}

async function main() {
    try {
        const currentVersion = await getCurrentVersion();
        const suggestedVersion = calculateNextPatch(currentVersion);

        const { version } = await inquirer.prompt([
            {
                name: 'version',
                message: `Enter version to release (current: ${currentVersion})`,
                default: suggestedVersion,
                validate: input => semver.valid(input) ? true : 'Must be a valid semver (e.g., 1.0.0)',
            },
        ]);

        console.log(`🚀 Releasing version ${version}`);

        // Step 1: Update version
        await updateVersionInComposer(version);

        // Step 2: Build frontend assets
        console.log('📦 Installing and building frontend...');
        await execa('npm', ['install'], { cwd: UI_PATH, stdio: 'inherit' });
        await execa('npm', ['run', 'build'], { cwd: UI_PATH, stdio: 'inherit' });

        // Step 3: Git commit, tag, push
        console.log('🔧 Staging files...');
        await git.add('.');

        console.log('✅ Committing release...');
        await git.commit(`Release v${version}`);

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
