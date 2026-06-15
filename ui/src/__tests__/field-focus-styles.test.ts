import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import Input from '../components/ui/input.vue';
import Textarea from '../components/ui/textarea.vue';

function expectBorderOnlyFocus(classes: string[]) {
    expect(classes).toContain('focus-visible:border-ring');
    expect(classes.filter((className) => /^focus-visible:ring/.test(className))).toEqual([]);
    expect(classes.filter((className) => className.includes('ring-offset'))).toEqual([]);
    expect(classes.filter((className) => /^focus-visible:(shadow|drop-shadow|blur)/.test(className))).toEqual([]);
    expect(classes.filter((className) => /^shadow/.test(className))).toEqual([]);
}

function expectBorderOnlyFocusSource(source: string) {
    expect(source).toContain('focus-visible:border-ring');
    expect(source).not.toMatch(/focus-visible:ring/);
    expect(source).not.toMatch(/ring-offset/);
    expect(source).not.toMatch(/focus-visible:(shadow|drop-shadow|blur)/);
    expect(source).not.toMatch(/\bshadow-(xs|sm|md|lg|xl|2xl)\b/);
}

describe('field focus styles', () => {
    it('keeps the SDK input primitive focus treatment to a border change', () => {
        const wrapper = mount(Input);

        expectBorderOnlyFocus(wrapper.get('input').classes());
    });

    it('keeps the SDK textarea primitive focus treatment to a border change', () => {
        const wrapper = mount(Textarea);

        expectBorderOnlyFocus(wrapper.get('textarea').classes());
    });

    it('keeps external role selects aligned with field focus treatment', () => {
        const source = readFileSync(join(process.cwd(), 'src/components/ExternalRoleSettings.vue'), 'utf8');
        const selectIndex = source.indexOf('<select');
        const selectSource = source.slice(selectIndex, selectIndex + 600);

        expect(selectIndex).toBeGreaterThan(-1);
        expectBorderOnlyFocusSource(selectSource);
    });

    it('keeps the requirement collaborator mode toggle aligned with field focus treatment', () => {
        const source = readFileSync(join(process.cwd(), 'src/components/task-list/RequirementPackForm.vue'), 'utf8');
        const toggleIndex = source.indexOf('data-testid="requirement-collaborator-mode-toggle"');
        const toggleSource = source.slice(Math.max(0, toggleIndex - 500), toggleIndex + 300);

        expect(toggleIndex).toBeGreaterThan(-1);
        expectBorderOnlyFocusSource(toggleSource);
    });

    it('keeps the SDK task edit title field visibly bordered until focus changes only the border', () => {
        const source = readFileSync(join(process.cwd(), 'src/components/task-list/TaskEditSheet.vue'), 'utf8');
        const titleInputIndex = source.indexOf('data-testid="task-edit-title"');
        const titleInputSource = source.slice(Math.max(0, titleInputIndex - 600), titleInputIndex + 300);

        expect(titleInputIndex).toBeGreaterThan(-1);
        expectBorderOnlyFocusSource(titleInputSource);
        expect(titleInputSource).toContain('border-input');
        expect(titleInputSource).not.toContain('border-transparent');
    });

    it('keeps widget text fields border-only on focus', () => {
        const source = readFileSync(join(process.cwd(), 'src/widget/widget.css'), 'utf8');
        const fieldFocusRule =
            source.match(/\.shift-widget__field input:focus,[\s\S]*?\.shift-widget__field textarea:focus[\s\S]*?\{([\s\S]*?)\n\}/)?.[1] ?? '';

        expect(fieldFocusRule).toContain('border-color: var(--shift-widget-primary);');
        expect(fieldFocusRule).toContain('outline: none;');
        expect(fieldFocusRule).not.toMatch(/outline:\s*2px/);
        expect(fieldFocusRule).not.toMatch(/box-shadow/);
    });

    it('keeps editor and rendered rich content paragraph spacing aligned', () => {
        const source = readFileSync(join(process.cwd(), 'src/style.css'), 'utf8');

        expect(source).toMatch(/\.ProseMirror > p \+ p,\s*\.shift-rich > p \+ p\s*\{[\s\S]*?margin-top:\s*0\.75rem;/);
    });

    it('keeps editor and rendered rich content code blocks aligned', () => {
        const source = readFileSync(join(process.cwd(), 'src/style.css'), 'utf8');

        expect(source).toMatch(/\.ProseMirror pre,\s*\.shift-rich pre\s*\{[\s\S]*?padding:\s*0\.5rem 0\.625rem;/);
        expect(source).toMatch(/\.ProseMirror pre,\s*\.shift-rich pre\s*\{[\s\S]*?border-radius:\s*0\.25rem;/);
        expect(source).toMatch(/\.ProseMirror pre,\s*\.shift-rich pre\s*\{[\s\S]*?overflow-x:\s*auto;/);
        expect(source).toMatch(/\.ProseMirror pre,\s*\.shift-rich pre\s*\{[\s\S]*?background:\s*#e5e7eb;/);
        expect(source).toMatch(/\.ProseMirror pre code,\s*\.shift-rich pre code\s*\{[\s\S]*?white-space:\s*pre;/);
        expect(source).toMatch(/\.ProseMirror pre code\.hljs,\s*\.shift-rich pre code\.hljs\s*\{[\s\S]*?padding:\s*0;/);
    });
});
