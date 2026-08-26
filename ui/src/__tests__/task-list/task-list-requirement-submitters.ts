import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import TaskList from '../../components/TaskList.vue';
import { defaultTasks, getMock, makeIndexResponse, postMock, resetTaskListTestState, stubs } from './test-helpers';

const requirementItems = [
    {
        id: 20,
        title: 'Quiet requirement',
        status: 'pending',
        requirement_status: 'submitted',
        priority: 'medium',
        phase: 'requirement',
        finalized: false,
        environment: 'local',
    },
];

describe('TaskList requirement submitters', () => {
    beforeEach(resetTaskListTestState);

    it('preselects the submitter and allows opting out before requirement submission', async () => {
        (window as any).shiftConfig = {
            appEnvironment: 'local',
            userId: 42,
            username: 'David McNee',
            email: 'david@example.com',
        };
        getMock
            .mockResolvedValueOnce(makeIndexResponse(defaultTasks))
            .mockResolvedValueOnce(makeIndexResponse([]))
            .mockResolvedValueOnce(makeIndexResponse(requirementItems));
        postMock.mockResolvedValueOnce({
            data: {
                batch: { id: 7, title: 'Delegated follow up' },
                items: requirementItems,
            },
        });

        const wrapper = mount(TaskList, { global: { stubs } });
        await flushPromises();
        await nextTick();

        await wrapper.get('[data-testid="requirements-tab"]').trigger('click');
        await flushPromises();
        await nextTick();
        await wrapper.get('[data-testid="open-requirement-pack"]').trigger('click');
        await nextTick();

        const form = wrapper.get('[data-testid="requirement-pack-form"]');
        const collaboratorStub = form.get('[data-testid="stub-task-collaborators"]');
        expect(collaboratorStub.attributes('data-external-count')).toBe('1');
        await collaboratorStub.get('[data-testid="stub-remove-external-collaborators"]').trigger('click');
        await nextTick();
        expect(collaboratorStub.attributes('data-external-count')).toBe('0');

        await form.get('[data-testid="requirement-pack-title"]').setValue('Delegated follow up');
        await form.get('[data-testid="add-requirement-item-empty"]').trigger('click');
        await nextTick();
        await form.get('[data-testid="requirement-item-title-0"]').setValue('Quiet requirement');
        await form.get('[data-testid="requirement-item-description-0"] [data-testid="stub-editor-input"]').setValue('A teammate will follow up');
        await form.trigger('submit');
        await flushPromises();
        await nextTick();

        expect(postMock).toHaveBeenCalledWith(
            '/shift/api/requirements/batches',
            expect.objectContaining({
                title: 'Delegated follow up',
                external_collaborators: [],
                include_submitter_as_collaborator: false,
            }),
        );

        wrapper.unmount();
    });
});
