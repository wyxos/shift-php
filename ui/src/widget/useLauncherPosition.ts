import { computed, ref } from 'vue';

type Position = { right: number; bottom: number };

const storageKey = 'shift.feedback-launcher.position.v1';
const edge = 12;
const launcherSize = 48;
const touchHoldMs = 350;
const dragThreshold = 6;
const keyStep = 32;

function loadPosition(): Position | null {
    try {
        const stored = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
        if ([stored?.right, stored?.bottom].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) {
            return stored;
        }
    } catch {
        // Storage can be disabled by the host browser.
    }
    return null;
}

function travel(size: number) {
    return Math.max(1, size - 2 * edge - launcherSize);
}

function fraction(offset: number, size: number) {
    return Math.min(1, Math.max(0, (offset - edge) / travel(size)));
}

export function useLauncherPosition() {
    const position = ref(loadPosition());
    const dragging = ref(false);
    let suppressClick = false;
    let gesture: {
        pointerId: number;
        x: number;
        y: number;
        right: number;
        bottom: number;
        startTime: number;
        previous: Position | null;
        canceled: boolean;
    } | null = null;

    const launcherStyle = computed(() => position.value ? {
        '--shift-launcher-right-fraction': position.value.right,
        '--shift-launcher-bottom-fraction': position.value.bottom,
    } : undefined);

    function savePosition() {
        try {
            if (position.value) {
                localStorage.setItem(storageKey, JSON.stringify(position.value));
            } else {
                localStorage.removeItem(storageKey);
            }
        } catch {
            // The position still works for the current page.
        }
    }

    function moveTo(right: number, bottom: number) {
        position.value = {
            right: fraction(right, window.innerWidth),
            bottom: fraction(bottom, window.innerHeight),
        };
    }

    function startDrag(event: PointerEvent) {
        if (!event.isPrimary || event.button !== 0) return;
        const launcher = event.currentTarget as HTMLButtonElement;
        const bounds = launcher.getBoundingClientRect();
        launcher.setPointerCapture(event.pointerId);
        suppressClick = false;
        gesture = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            right: window.innerWidth - bounds.right,
            bottom: window.innerHeight - bounds.bottom,
            startTime: event.timeStamp,
            previous: position.value,
            canceled: false,
        };
    }

    function drag(event: PointerEvent) {
        if (!gesture || gesture.pointerId !== event.pointerId || gesture.canceled) return;
        const dx = event.clientX - gesture.x;
        const dy = event.clientY - gesture.y;
        if (!dragging.value && Math.hypot(dx, dy) < dragThreshold) return;
        // Pointer events supply the press duration without scheduling a timer.
        if (event.pointerType === 'touch' && event.timeStamp - gesture.startTime < touchHoldMs) {
            gesture.canceled = true;
            return;
        }
        dragging.value = true;
        moveTo(gesture.right - dx, gesture.bottom - dy);
    }

    function endDrag(event: PointerEvent) {
        if (!gesture || gesture.pointerId !== event.pointerId) return;
        suppressClick = dragging.value || gesture.canceled ||
            (event.pointerType === 'touch' && event.timeStamp - gesture.startTime >= touchHoldMs);
        if (dragging.value) savePosition();
        dragging.value = false;
        gesture = null;
    }

    function cancelDrag(event: PointerEvent) {
        if (!gesture || gesture.pointerId !== event.pointerId) return;
        if (dragging.value) position.value = gesture.previous;
        dragging.value = false;
        gesture = null;
    }

    function allowOpen(event: MouseEvent) {
        const allow = !suppressClick || event.detail === 0;
        suppressClick = false;
        return allow;
    }

    function moveWithKeyboard(event: KeyboardEvent) {
        if (!event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
        if (event.key === 'Home') {
            event.preventDefault();
            position.value = null;
            savePosition();
            return;
        }
        const directions: Record<string, [number, number]> = {
            ArrowLeft: [keyStep, 0],
            ArrowRight: [-keyStep, 0],
            ArrowUp: [0, keyStep],
            ArrowDown: [0, -keyStep],
        };
        const direction = directions[event.key];
        if (!direction) return;
        event.preventDefault();
        const bounds = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
        moveTo(window.innerWidth - bounds.right + direction[0], window.innerHeight - bounds.bottom + direction[1]);
        savePosition();
    }

    return { launcherStyle, dragging, startDrag, drag, endDrag, cancelDrag, allowOpen, moveWithKeyboard };
}
