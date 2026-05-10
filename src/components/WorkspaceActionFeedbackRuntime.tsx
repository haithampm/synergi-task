import { useEffect, useRef } from "react";
import { useIsMutating, useMutationState } from "@tanstack/react-query";

const SUCCESS_ACTION_CLOSE_DELAY_MS = 120;

const closeActiveOverlay = () => {
  const escapeEvent = new KeyboardEvent("keydown", {
    key: "Escape",
    code: "Escape",
    bubbles: true,
    cancelable: true,
  });

  document.dispatchEvent(escapeEvent);
  window.dispatchEvent(escapeEvent);

  const explicitCloseButton = document.querySelector<HTMLButtonElement>(
    '[data-radix-dialog-content] button[aria-label="Close"], [data-radix-dialog-content] button[data-dialog-close], [data-radix-dialog-content] [data-radix-dialog-close]',
  );
  explicitCloseButton?.click();

  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
};

const WorkspaceActionFeedbackRuntime = () => {
  const isMutating = useIsMutating();
  const successfulMutations = useMutationState({
    filters: { status: "success" },
    select: (mutation) => mutation.state.submittedAt,
  });
  const lastHandledSuccess = useRef(0);
  const mutationWasRunning = useRef(false);

  useEffect(() => {
    if (isMutating > 0) {
      mutationWasRunning.current = true;
      return;
    }

    const latestSuccess = Math.max(0, ...successfulMutations);
    const hasNewSuccess = latestSuccess > lastHandledSuccess.current;

    if (!mutationWasRunning.current || !hasNewSuccess) return;

    lastHandledSuccess.current = latestSuccess;
    mutationWasRunning.current = false;

    window.setTimeout(() => {
      closeActiveOverlay();
      window.dispatchEvent(
        new CustomEvent("workspace-action-completed", {
          detail: {
            status: "success",
            closedActiveForm: true,
            completedAt: new Date().toISOString(),
          },
        }),
      );
    }, SUCCESS_ACTION_CLOSE_DELAY_MS);
  }, [isMutating, successfulMutations]);

  return null;
};

export default WorkspaceActionFeedbackRuntime;
