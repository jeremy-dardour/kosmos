interface DotCaretProperties {
  /** The pipeline row's steps, in order — one equal-width column each. */
  stepIds: string[];
  targetStepId: string;
  /** Whether the pipeline row ends with the add-step column. */
  hasAppendColumn: boolean;
}

/**
 * Points a strip at the dot it belongs to by repeating the pipeline row's
 * column layout. The trailing spacer has to mirror the add-step button
 * exactly — a complete pipeline has none, and reserving it anyway shifts every
 * column and leaves the caret off its dot.
 */
export const DotCaret = ({
  stepIds,
  targetStepId,
  hasAppendColumn,
}: DotCaretProperties) => {
  return (
    <div aria-hidden className="flex items-start">
      {stepIds.map((stepId) => (
        <div key={stepId} className="flex min-w-0 flex-1 justify-center">
          {stepId === targetStepId && (
            <span className="mt-1 size-2.5 rotate-45 border-l border-t border-step-in-progress/40 bg-step-in-progress/8" />
          )}
        </div>
      ))}
      {hasAppendColumn && <div className="w-8" />}
    </div>
  );
};
