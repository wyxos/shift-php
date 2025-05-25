#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import semver from 'semver';
import inquirer from 'inquirer';
import { execa } from 'execa';

const PACKAGE_DIR = path.resolve('.');
const COMPOSER_PATH = path.join(PACKAGE_DIR, 'composer.json');
const UI_PATH = path.join(PACKAGE_DIR, './ui');

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

async function runCommand(command, args = [], opts = {}) {
    try {
        await execa(command, args, { stdio: 'inherit', ...opts });
    } catch (err) {
        throw new Error(`Command failed: ${command} ${args.join(' ')}\n${err.message}`);
    }
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

        // Update version in composer.json
        await updateVersionInComposer(version);

        // Build frontend assets
        console.log('📦 Installing and building frontend...');
        await runCommand('npm install', { cwd: UI_PATH });
        await runCommand('npm run build', { cwd: UI_PATH });

        // Stage changes
        console.log('🔧 Staging files...');
        await runCommand('git', ['add', PACKAGE_DIR]);

        // Commit and tag
        console.log('✅ Committing release...');
        await runCommand('git', ['commit', '-m', `Release v${version}`]);
        await runCommand('git', ['tag', `v${version}`]);

        // Push everything
        console.log('📤 Pushing to origin...');
        await runCommand('git', ['push', 'origin', 'HEAD']);
        await runCommand('git', ['push', 'origin', `v${version}`]);

        console.log('🎉 Release complete!');
    } catch (err) {
        console.error('❌ Release failed:', err.message);
        process.exit(1);
    }
}

main();
