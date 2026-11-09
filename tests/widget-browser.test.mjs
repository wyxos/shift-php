import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const assetsRoot = resolve(process.env.SHIFT_WIDGET_ASSETS_DIR ?? join(packageRoot, 'public/shift-assets'));
const output = process.env.SHIFT_WIDGET_REVIEW_DIR ?? join(tmpdir(), 'shift-widget-browser');
const submissions = [];
let browser;
let server;
let base;

before(async () => {
    await mkdir(output, { recursive: true });
    const manifest = JSON.parse(await readFile(join(assetsRoot, '.vite/manifest.json'), 'utf8'));
    const widget = manifest['src/widget.ts'];
    assert.ok(widget?.file && widget.css?.length, 'Build the SDK assets before running this regression.');
    const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Widget tap regression</title>
        ${widget.css.map((file) => `<link rel="stylesheet" href="/shift-assets/${file}">`).join('')}
        <style>
            body { margin: 0; font: 16px system-ui; background: #f4f4f5; color: #18181b; }
            main { padding: 24px; max-width: 600px; }
            #continue { position: fixed; bottom: 12px; left: 50%; transform: translateX(-50%);
                width: 180px; height: 48px; border: 0; border-radius: 6px; background: #166534; color: white; }
        </style></head><body><main><h1>Host application</h1><p>The host action remains usable beside Feedback.</p>
        <output aria-live="polite">Step 1</output></main><button id="continue">Continue</button>
        <script>
            let step = 1;
            document.querySelector('#continue').addEventListener('click', () => {
                document.querySelector('output').textContent = 'Step ' + ++step;
            });
            window.shiftWidgetConfig = {
                endpoints: { config: '/shift/api/widget/config', tasks: '/shift/api/widget/tasks',
                    sessionUser: '/shift/api/widget/session-user', login: '/shift/api/widget/login' },
                guestSubmissionsEnabled: true, authenticated: false, loginCredentialField: 'email',
                appName: 'Synthetic host'
            };
        </script><script type="module" src="/shift-assets/${widget.file}"></script></body></html>`;
    server = createServer(async (request, response) => {
        try {
            const url = new URL(request.url, 'http://127.0.0.1');
            if (url.pathname.startsWith('/shift-assets/')) {
                const file = resolve(assetsRoot, url.pathname.slice('/shift-assets/'.length));
                if (!file.startsWith(assetsRoot + sep)) throw new Error('Invalid asset path');
                response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'text/javascript');
                response.end(await readFile(file));
                return;
            }
            const json = (body) => {
                response.setHeader('Content-Type', 'application/json');
                response.end(JSON.stringify(body));
            };
            if (url.pathname === '/shift/api/widget/config') {
                json({ widget_enabled: true, guest_submissions_enabled: true, workspace_url: null });
            } else if (url.pathname === '/shift/api/widget/session-user') {
                json({ authenticated: false, user: null });
            } else if (url.pathname === '/shift/api/widget/tasks' && request.method === 'POST') {
                const chunks = [];
                for await (const chunk of request) chunks.push(chunk);
                submissions.push(JSON.parse(Buffer.concat(chunks).toString()));
                json({ id: 1 });
            } else if (url.pathname === '/') {
                response.setHeader('Content-Type', 'text/html');
                response.end(html);
            } else {
                response.writeHead(404).end();
            }
        } catch {
            response.writeHead(500).end('Widget fixture failed');
        }
    });
    await new Promise((done) => server.listen(0, '127.0.0.1', done));
    base = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch();
});

after(async () => {
    await browser?.close();
    if (server?.listening) await new Promise((done) => server.close(done));
});

for (const width of [320, 393, 520, 521, 1280]) {
    for (const reducedMotion of ['no-preference', 'reduce']) {
        test(`host taps and Feedback stay usable at ${width}px with motion ${reducedMotion}`, async () => {
            const context = await browser.newContext({
                viewport: { width, height: 736 },
                hasTouch: true,
                isMobile: width <= 520,
                reducedMotion,
            });
            const page = await context.newPage();
            page.setDefaultTimeout(2500);
            const errors = [];
            page.on('pageerror', (error) => errors.push(error.message));
            const screenshot = (state) => page.screenshot({ path: join(output, `${width}-${reducedMotion}-${state}.png`) });
            try {
                submissions.length = 0;
                await page.goto(base);
                const launcher = page.getByRole('button', { name: 'Feedback', exact: true });
                await launcher.waitFor({ state: 'visible' });
                await screenshot('closed');
                const hostAction = page.getByRole('button', { name: 'Continue', exact: true });
                // A real tap must pass through the closed widget's empty mobile wrapper.
                await hostAction.tap();
                assert.equal(await page.locator('output').textContent(), 'Step 2');
                await screenshot('host-tap');
                await launcher.tap();
                const panel = page.getByRole('region', { name: 'Feedback', exact: true });
                await panel.waitFor({ state: 'visible' });
                const bounds = await panel.boundingBox();
                assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width, 'Panel stays within the viewport');
                await panel.getByRole('button', { name: 'Report an issue', exact: true }).tap();
                await panel.getByLabel('Title', { exact: true }).tap();
                await page.keyboard.type('Synthetic tap regression');
                await panel.getByLabel('Description', { exact: true }).tap();
                await page.keyboard.type('The host action and feedback panel both receive taps.');
                await screenshot('open');
                await panel.getByRole('button', { name: 'Send', exact: true }).tap();
                await panel.getByRole('heading', { name: 'Request submitted' }).waitFor();
                assert.equal(submissions.length, 1);
                assert.equal(submissions[0].kind, 'issue');
                assert.equal(submissions[0].anonymous, true);
                await panel.getByRole('button', { name: 'Close', exact: true }).first().tap();
                await hostAction.tap();
                assert.equal(await page.locator('output').textContent(), 'Step 3');
                // Pointer transparency must not remove the launcher from keyboard navigation.
                await page.keyboard.press('Tab');
                assert.equal(await launcher.evaluate((element) => element === document.activeElement), true);
                await page.keyboard.press('Enter');
                await panel.waitFor({ state: 'visible' });
                if (width > 520) {
                    await panel.getByRole('button', { name: 'Close', exact: true }).first().click();
                    await hostAction.click();
                    assert.equal(await page.locator('output').textContent(), 'Step 4');
                    await launcher.hover();
                    await launcher.click();
                    await panel.waitFor({ state: 'visible' });
                }
                assert.deepEqual(errors, []);
            } finally {
                await context.close();
            }
        });
    }
}

test('a held touch can move Feedback without opening it and the next tap opens it', async () => {
    const context = await browser.newContext({ viewport: { width: 393, height: 736 }, hasTouch: true, isMobile: true });
    try {
        const page = await context.newPage();
        const client = await context.newCDPSession(page);
        await page.goto(base);
        const launcher = page.getByRole('button', { name: 'Feedback', exact: true });
        await launcher.waitFor({ state: 'visible' });
        const initial = await launcher.boundingBox();
        const touch = (type, x, y) => client.send('Input.dispatchTouchEvent', {
            type,
            touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y }],
        });
        const x = initial.x + initial.width / 2;
        const y = initial.y + initial.height / 2;
        await touch('touchStart', x, y);
        await touch('touchMove', x - 40, y - 40);
        await touch('touchEnd');
        assert.deepEqual(await launcher.boundingBox(), initial, 'Moving before holding does not drag');

        await touch('touchStart', x, y);
        // CDP sends real touch events. Hold the pointer down before moving it.
        await new Promise((resolve) => setTimeout(resolve, 400));
        await touch('touchMove', 80, 180);
        await touch('touchEnd');
        assert.equal(await page.getByRole('region', { name: 'Feedback', exact: true }).count(), 0);
        const moved = await launcher.boundingBox();
        assert.ok(moved.x < initial.x - 100 && moved.y < initial.y - 100);
        await page.screenshot({ path: join(output, 'touch-launcher-repositioned.png') });

        await page.reload();
        await launcher.waitFor({ state: 'visible' });
        assert.deepEqual(await launcher.boundingBox(), moved, 'Position survives reload');
        await touch('touchStart', moved.x + moved.width / 2, moved.y + moved.height / 2);
        await new Promise((resolve) => setTimeout(resolve, 400));
        await touch('touchMove', 260, 360);
        await touch('touchCancel');
        assert.deepEqual(await launcher.boundingBox(), moved, 'Cancel restores the last chosen position');

        await page.getByRole('button', { name: 'Continue', exact: true }).tap();
        assert.equal(await page.locator('output').textContent(), 'Step 2');
        await launcher.tap();
        await page.getByRole('region', { name: 'Feedback', exact: true }).waitFor({ state: 'visible' });
    } finally {
        await context.close();
    }
});

test('mouse and keyboard can place and reset Feedback while keeping it in bounds', async () => {
    const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' });
    try {
        const page = await context.newPage();
        await page.goto(base);
        const launcher = page.getByRole('button', { name: 'Feedback', exact: true });
        await launcher.waitFor({ state: 'visible' });
        const initial = await launcher.boundingBox();
        await page.mouse.move(initial.x + initial.width / 2, initial.y + initial.height / 2);
        await page.mouse.down();
        await page.mouse.move(0, 0, { steps: 6 });
        await page.mouse.up();
        assert.equal(await page.getByRole('region', { name: 'Feedback', exact: true }).count(), 0);
        let moved = await launcher.boundingBox();
        assert.ok(moved.x >= 11 && moved.x < 30 && moved.y >= 11 && moved.y < 30);

        await page.setViewportSize({ width: 320, height: 500 });
        await launcher.focus();
        await page.keyboard.press('Shift+ArrowRight');
        await page.keyboard.press('Shift+ArrowDown');
        moved = await launcher.boundingBox();
        assert.ok(moved.x >= 11 && moved.x + moved.width <= 309 && moved.y > 30 && moved.y + moved.height <= 489);
        await page.keyboard.press('Shift+Home');
        const reset = await launcher.boundingBox();
        assert.ok(reset.x > 180 && reset.y > 400, 'Keyboard reset restores the default corner');
        await page.keyboard.press('Enter');
        await page.getByRole('region', { name: 'Feedback', exact: true }).waitFor({ state: 'visible' });
    } finally {
        await context.close();
    }
});
