import { Step, StepOutcome } from '@/database/entities/step.entity';
import {
  Workstream,
  WorkstreamLifecycle,
} from '@/database/entities/workstream.entity';

function buildWorkstream(
  overrides: Partial<Pick<Workstream, 'startedAt' | 'completedAt'>> = {},
): Workstream {
  const ws = new Workstream();
  ws.startedAt = overrides.startedAt ?? null;
  ws.completedAt = overrides.completedAt ?? null;

  return ws;
}

function buildStep(overrides: {
  position: number;
  name?: string;
  deadline?: string | null;
  outcome?: StepOutcome | null;
}): Step {
  const s = new Step();
  s.position = overrides.position;
  s.name = overrides.name ?? `Step ${overrides.position}`;
  s.deadline = overrides.deadline ?? null;
  s.outcome = overrides.outcome ?? null;

  return s;
}

function workstreamWith(...steps: Step[]): Workstream {
  const ws = buildWorkstream({ startedAt: new Date() });
  ws.steps.getItems = () => steps;

  return ws;
}

describe('workstream.getLifecycle', () => {
  it('is NotStarted while startedAt is unset', () => {
    expect(buildWorkstream().getLifecycle()).toBe(
      WorkstreamLifecycle.NotStarted,
    );
  });

  it('is Active once started and not yet completed', () => {
    expect(buildWorkstream({ startedAt: new Date() }).getLifecycle()).toBe(
      WorkstreamLifecycle.Active,
    );
  });

  it('is Complete once completedAt is set', () => {
    expect(
      buildWorkstream({
        startedAt: new Date(),
        completedAt: new Date(),
      }).getLifecycle(),
    ).toBe(WorkstreamLifecycle.Complete);
  });
});

describe('workstream.nearestDeadlineStep', () => {
  it('returns null when no step has a deadline', () => {
    const ws = workstreamWith(
      buildStep({ position: 1 }),
      buildStep({ position: 2 }),
    );

    expect(ws.nearestDeadlineStep()).toBeNull();
  });

  it('picks the earliest deadline among unpassed steps', () => {
    const ws = workstreamWith(
      buildStep({ position: 1, deadline: '2026-08-20' }),
      buildStep({ position: 2, deadline: '2026-08-01' }),
      buildStep({ position: 3, deadline: '2026-09-15' }),
    );

    expect(ws.nearestDeadlineStep()?.name).toBe('Step 2');
  });

  it('ignores steps that already have an outcome', () => {
    const ws = workstreamWith(
      buildStep({
        position: 1,
        deadline: '2026-07-01',
        outcome: StepOutcome.Done,
      }),
      buildStep({
        position: 2,
        deadline: '2026-07-10',
        outcome: StepOutcome.Skipped,
      }),
      buildStep({ position: 3, deadline: '2026-08-10' }),
    );

    expect(ws.nearestDeadlineStep()?.deadline).toBe('2026-08-10');
  });

  it('returns null when every step has been passed', () => {
    const ws = workstreamWith(
      buildStep({
        position: 1,
        deadline: '2026-07-01',
        outcome: StepOutcome.Done,
      }),
    );

    expect(ws.nearestDeadlineStep()).toBeNull();
  });

  it('surfaces an overdue deadline ahead of a later deadline', () => {
    const ws = workstreamWith(
      buildStep({ position: 1, deadline: '2026-07-15' }),
      buildStep({ position: 2, deadline: '2026-07-30' }),
    );

    expect(ws.nearestDeadlineStep()?.name).toBe('Step 1');
  });

  it('breaks ties on the same date by pipeline position', () => {
    const ws = workstreamWith(
      buildStep({ position: 4, deadline: '2026-08-01' }),
      buildStep({ position: 2, deadline: '2026-08-01' }),
    );

    expect(ws.nearestDeadlineStep()?.name).toBe('Step 2');
  });
});
