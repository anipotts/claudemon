import { type JSX, type ParentComponent, createSignal, Show, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";

/**
 * Viewport-aware tooltip that never clips off-screen.
 * Uses position:fixed + Portal to escape all overflow containers.
 */
export const SmartTooltip: ParentComponent<{
  content: JSX.Element;
}> = (props) => {
  const [visible, setVisible] = createSignal(false);
  const [pos, setPos] = createSignal({ left: 0, top: 0, below: false });
  let triggerRef: HTMLSpanElement | undefined;
  let hideTimer: ReturnType<typeof setTimeout>;

  const show = () => {
    clearTimeout(hideTimer);
    if (!triggerRef) return;
    const rect = triggerRef.getBoundingClientRect();
    const maxW = 340;
    const gap = 6;

    // Horizontal: prefer left-aligned with trigger, clamp to viewport
    let left = rect.left;
    if (left + maxW > window.innerWidth - 8) left = window.innerWidth - maxW - 8;
    if (left < 8) left = 8;

    // Vertical: prefer above; if too close to top, show below
    const below = rect.top < 80;
    const top = below ? rect.bottom + gap : rect.top - gap;

    setPos({ left, top, below });
    setVisible(true);
  };

  const hide = () => {
    hideTimer = setTimeout(() => setVisible(false), 80);
  };

  onCleanup(() => clearTimeout(hideTimer));

  return (
    <span ref={triggerRef} onMouseEnter={show} onMouseLeave={hide} class="inline-flex">
      {props.children}
      <Show when={visible()}>
        <Portal>
          <div
            class="smart-tooltip"
            style={{
              position: "fixed",
              left: `${pos().left}px`,
              top: `${pos().top}px`,
              transform: pos().below ? "none" : "translateY(-100%)",
              "max-width": "340px",
              "z-index": "9999",
            }}
          >
            {props.content}
          </div>
        </Portal>
      </Show>
    </span>
  );
};
