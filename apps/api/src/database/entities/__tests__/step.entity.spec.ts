import { Step, StepOutcome, StepStatus } from '@/database/entities/step.entity';

function buildStep(position: number, outcome: StepOutcome | null = null): Step {
  const s = new Step();
  s.position = position;
  s.outcome = outcome;

  return s;
}

describe('step.getStatus', () => {
  it('reports the recorded outcome for passed steps', () => {
    expect(buildStep(1, StepOutcome.Done).getStatus(3)).toBe(StepStatus.Done);
    expect(buildStep(2, StepOutcome.Skipped).getStatus(3)).toBe(
      StepStatus.Skipped,
    );
  });

  it('reports InProgress for the step at the pointer', () => {
    expect(buildStep(3).getStatus(3)).toBe(StepStatus.InProgress);
  });

  it('reports NotStarted for steps ahead of the pointer', () => {
    expect(buildStep(4).getStatus(3)).toBe(StepStatus.NotStarted);
  });

  it('reports NotStarted for every step when there is no pointer', () => {
    expect(buildStep(1).getStatus(null)).toBe(StepStatus.NotStarted);
  });

  it('still reports outcomes for a completed workstream with no pointer', () => {
    expect(buildStep(2, StepOutcome.Done).getStatus(null)).toBe(
      StepStatus.Done,
    );
  });
});
