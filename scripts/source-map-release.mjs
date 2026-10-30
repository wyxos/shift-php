import { lstat, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execa } from 'execa';

const quote = value => `'${String(value).replaceAll("'", "'\\''")}'`;
const remoteTemporary = /^\/tmp\/shift-sdk-build\.[A-Za-z0-9]+$/;
const sshOptions = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10'];

function target(value) {
    const fields = ['name', 'transport', 'host', 'projectPath', 'php'];
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key))
        || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 120 || /[\x00-\x1f\x7f]/.test(value.name)
        || !['ssh', 'local'].includes(value.transport) || typeof value.projectPath !== 'string'
        || !value.projectPath.startsWith('/') || /[\0\r\n]/.test(value.projectPath)
        || (value.php !== undefined && (typeof value.php !== 'string' || /[\x00-\x1f\x7f]/.test(value.php) || !/^(?:php(?:[0-9.]+)?|\/[^\0\r\n]+)$/.test(value.php)))) {
        throw new Error('Invalid SDK source-map release target configuration.');
    }
    if (value.transport === 'ssh' && (typeof value.host !== 'string' || /[\x00-\x1f\x7f]/.test(value.host) || !/^[A-Za-z0-9_][A-Za-z0-9_.@-]*$/.test(value.host))) {
        throw new Error('Invalid SDK source-map SSH target.');
    }
    if (value.transport === 'local' && value.host !== undefined) throw new Error('Local SDK source-map target cannot declare an SSH host.');
    return { ...value, name: value.name.trim(), php: value.php ?? 'php' };
}

export async function loadTargets(configPath) {
    const stat = await lstat(configPath).catch(error => {
        if (error.code === 'ENOENT') throw new Error('Configure SDK source-map release targets in .shift-sdk-release.json or --source-map-targets before publishing.');
        throw error;
    });
    if (!stat.isFile() || stat.size > 64_000) throw new Error('SDK source-map release configuration is not a bounded regular file.');
    const bytes = await readFile(configPath);
    if (bytes.length > 64_000) throw new Error('SDK source-map release configuration is oversized.');
    const config = JSON.parse(bytes.toString());
    if (!config || typeof config !== 'object' || Array.isArray(config) || config.schema_version !== 1 || !Array.isArray(config.targets) || config.targets.length < 1 || config.targets.length > 20
        || Object.keys(config).some(key => !['schema_version', 'targets'].includes(key))) {
        throw new Error('SDK source-map releases require a non-empty schema_version 1 target list.');
    }
    const targets = config.targets.map(target);
    if (new Set(targets.map(item => item.name)).size !== targets.length) throw new Error('SDK source-map target names must be unique.');
    const destinations = targets.map(item => JSON.stringify([item.transport, item.host ?? null, path.posix.resolve(item.projectPath)]));
    if (new Set(destinations).size !== targets.length) throw new Error('SDK source-map target destinations must be unique.');
    return targets;
}

export function registrationPlan(targets, artifact = null) {
    return targets.map(item => ({ name: item.name, transport: item.transport, build_id: artifact?.buildId ?? 'next successful UI build' }));
}

function verifyReceipt(output, artifact) {
    let receipt;
    try { receipt = JSON.parse(output.trim()); } catch { throw new Error('SHIFT returned an invalid SDK source-map registration receipt.'); }
    if (receipt.schema_version !== 1 || receipt.build_id !== artifact.buildId || receipt.manifest_sha256 !== artifact.manifestDigest
        || receipt.assets_count !== artifact.assetsCount || receipt.verified !== true) {
        throw new Error('SHIFT did not verify the exact SDK source-map build being released.');
    }
    return receipt;
}

async function operation(stage, action) {
    try { return await action(); } catch (cause) {
        throw Object.assign(new Error(`SDK source-map ${stage} failed.`, { cause }), {
            stage,
            exitCode: Number.isInteger(cause.exitCode) ? cause.exitCode : null,
        });
    }
}

async function stage(artifact) {
    const root = await mkdtemp(path.join(tmpdir(), 'shift-sdk-registration-'));
    try {
        await mkdir(path.join(root, 'assets'), { mode: 0o700 });
        for (const item of artifact.files) await writeFile(path.join(root, item.relative), item.bytes, { mode: 0o600 });
        return root;
    } catch (error) {
        await rm(root, { recursive: true, force: true });
        throw error;
    }
}

async function localRegistration(target, artifact, staged, run) {
    const options = { cwd: target.projectPath, timeout: 120_000 };
    await operation('import', async () => verifyReceipt((await run(target.php, ['artisan', 'shift:sdk-build:import', staged, '--json'], options)).stdout, artifact));
    return operation('verification', async () => verifyReceipt((await run(target.php, ['artisan', 'shift:sdk-build:verify', artifact.buildId, '--json'], options)).stdout, artifact));
}

async function sshRegistration(target, artifact, staged, run) {
    const ssh = command => run('ssh', [...sshOptions, target.host, command], { timeout: 120_000 });
    let temporary;
    let failure;
    try {
        const created = await operation('SSH connection/setup', () => ssh('umask 077; directory=$(mktemp -d /tmp/shift-sdk-build.XXXXXXXXXX) || exit 1; trap \'rm -rf -- "$directory"\' 0; mkdir "$directory/assets" && printf \'%s\\n\' "$directory" && trap - 0'));
        temporary = created.stdout.trim();
        if (!remoteTemporary.test(temporary)) { temporary = null; throw new Error('SSH returned an unsafe SDK source-map upload directory.'); }
        await operation('SSH artifact transfer', () => run('scp', ['-q', ...sshOptions, '--', path.join(staged, 'manifest.json'), `${target.host}:${temporary}/manifest.json`], { timeout: 120_000 }));
        const assets = artifact.files.filter(item => item.relative !== 'manifest.json').map(item => path.join(staged, item.relative));
        await operation('SSH artifact transfer', () => run('scp', ['-q', ...sshOptions, '--', ...assets, `${target.host}:${temporary}/assets/`], { timeout: 120_000 }));
        const command = args => `cd ${quote(target.projectPath)} && ${quote(target.php)} artisan ${args.map(quote).join(' ')}`;
        await operation('import', async () => verifyReceipt((await ssh(command(['shift:sdk-build:import', temporary, '--json']))).stdout, artifact));
        const verified = await operation('verification', async () => verifyReceipt((await ssh(command(['shift:sdk-build:verify', artifact.buildId, '--json']))).stdout, artifact));
        return verified;
    } catch (error) {
        failure = error;
        throw error;
    } finally {
        if (temporary) {
            try { await ssh(`rm -rf -- ${quote(temporary)}`); } catch {
                throw Object.assign(new Error(`SDK source-map private upload cleanup failed for ${target.name} at ${temporary}${failure ? '; registration also failed' : ''}; publication stopped.`), { code: 'SDK_PRIVATE_UPLOAD_CLEANUP_FAILED' });
            }
        }
    }
}

export async function registerSourceMaps(artifact, targets, { run = execa, log = console.log } = {}) {
    const staged = await stage(artifact);
    const receipts = [];
    try {
        for (const target of targets) {
            log(`Registering SDK build ${artifact.buildId} with ${target.name}...`);
            try {
                const receipt = target.transport === 'local'
                    ? await localRegistration(target, artifact, staged, run)
                    : await sshRegistration(target, artifact, staged, run);
                receipts.push({ target: target.name, ...receipt });
            } catch (error) {
                if (error.code === 'SDK_PRIVATE_UPLOAD_CLEANUP_FAILED') throw error;
                throw new Error(`SDK source-map registration failed for ${target.name} during ${error.stage ?? 'registration'}${Number.isInteger(error.exitCode) ? ` (exit ${error.exitCode})` : ''}; publication stopped. Fix the target and retry with --register-source-maps.`, { cause: error });
            }
        }
        return receipts;
    } finally {
        await rm(staged, { recursive: true, force: true });
    }
}
