import { Seeder } from '@mikro-orm/seeder';

import { Group } from '@/database/entities/group.entity';
import { Project } from '@/database/entities/project.entity';
import { Step, StepOutcome } from '@/database/entities/step.entity';
import { User } from '@/database/entities/user.entity';
import { Workstream } from '@/database/entities/workstream.entity';
import {
  calendarDay as day,
  instantAt as at,
} from '@/shared/utils/calendar-day';

import type { EntityManager } from '@mikro-orm/core';

interface StepSeed {
  name: string;
  deadline?: string;
  outcome?: StepOutcome;
  outcomeAt?: Date;
  blocked?: boolean;
  owner?: User;
  checklist?: { name: string; done: boolean }[];
  notes?: { content: string; author: User; createdAt: Date }[];
}

interface WorkstreamSeed {
  name: string;
  icon: string;
  group?: Group;
  owner?: User;
  startedAt?: Date;
  completedAt?: Date;
  /** 1-indexed position of the current step; omit for NotStarted / Complete. */
  currentPosition?: number;
  steps: StepSeed[];
}

/**
 * Development fixture covering every lifecycle, step status and deadline
 * urgency band the overview renders. Dates are relative to the run date.
 */
export class LocalDatabaseSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    await this.clear(em);

    const jeremy = em.create(User, {
      email: 'jeremy@example.com',
      name: 'Jeremy',
      avatarUrl: null,
    });
    const partner = em.create(User, {
      email: 'partner@example.com',
      name: 'Alex Doe',
      avatarUrl: null,
    });
    const helper = em.create(User, {
      email: 'helper@example.com',
      name: 'Sam Reed',
      avatarUrl: null,
    });

    const project = em.create(Project, {
      name: 'Wedding Prep',
      eventDate: day(147),
    });

    const logistics = em.create(Group, {
      project,
      name: 'Logistics',
      color: '#8b6cc1',
    });
    const foodAndDrink = em.create(Group, {
      project,
      name: 'Food & Drink',
      color: '#e09850',
    });
    const vendors = em.create(Group, {
      project,
      name: 'Vendors',
      color: '#5a9e6f',
    });
    const attire = em.create(Group, {
      project,
      name: 'Attire',
      color: '#c16c8b',
    });

    await em.flush();

    const workstreams: WorkstreamSeed[] = [
      {
        name: 'Venue',
        icon: '🏛️',
        group: vendors,
        owner: jeremy,
        startedAt: at(-120),
        completedAt: at(-30),
        steps: [
          {
            name: 'Shortlist venues',
            outcome: StepOutcome.Done,
            outcomeAt: at(-110),
          },
          {
            name: 'Visit venues',
            outcome: StepOutcome.Done,
            outcomeAt: at(-90),
            checklist: [
              { name: 'Old Mill Barn', done: true },
              { name: 'Riverside Hall', done: true },
              { name: 'The Orangery', done: false },
            ],
          },
          {
            name: 'Compare quotes',
            outcome: StepOutcome.Skipped,
            outcomeAt: at(-70),
          },
          {
            name: 'Sign contract',
            deadline: day(-35),
            outcome: StepOutcome.Done,
            outcomeAt: at(-30),
            notes: [
              {
                content:
                  'Signed and deposit paid. Contract: https://example.com/venue-contract',
                author: jeremy,
                createdAt: at(-30),
              },
            ],
          },
        ],
      },
      {
        name: 'Catering',
        icon: '🍽️',
        group: foodAndDrink,
        owner: partner,
        startedAt: at(-60),
        currentPosition: 3,
        steps: [
          {
            name: 'Define menu style',
            outcome: StepOutcome.Done,
            outcomeAt: at(-55),
          },
          {
            name: 'Request quotes',
            outcome: StepOutcome.Done,
            outcomeAt: at(-40),
          },
          {
            name: 'Tasting sessions',
            deadline: day(30),
            checklist: [
              { name: 'Green Fig Kitchen', done: true },
              { name: 'Two Spoons', done: false },
              { name: 'Harvest & Co', done: false },
            ],
            notes: [
              {
                content: 'Green Fig were excellent — shortlist them.',
                author: partner,
                createdAt: at(-8),
              },
              {
                content: 'Waiting on Harvest & Co to confirm a date.',
                author: jeremy,
                createdAt: at(-3),
              },
            ],
          },
          { name: 'Choose caterer', deadline: day(52) },
          { name: 'Confirm final numbers', deadline: day(120) },
        ],
      },
      {
        name: 'Invitations',
        icon: '✉️',
        group: logistics,
        owner: jeremy,
        startedAt: at(-45),
        currentPosition: 2,
        steps: [
          {
            name: 'Draft guest list',
            outcome: StepOutcome.Done,
            outcomeAt: at(-40),
          },
          {
            name: 'Collect addresses',
            deadline: day(-10),
            blocked: true,
            owner: helper,
            notes: [
              {
                content:
                  'Blocked: waiting on the final guest list from both families.',
                author: helper,
                createdAt: at(-12),
              },
            ],
          },
          { name: 'Design invitations', deadline: day(20) },
          { name: 'Send invitations', deadline: day(60) },
        ],
      },
      {
        name: 'Attire',
        icon: '👗',
        group: attire,
        owner: partner,
        startedAt: at(-20),
        currentPosition: 2,
        steps: [
          {
            name: 'Browse styles',
            outcome: StepOutcome.Done,
            outcomeAt: at(-15),
          },
          { name: 'First fitting', deadline: day(4) },
          { name: 'Alterations', deadline: day(45) },
          { name: 'Final fitting', deadline: day(110) },
        ],
      },
      {
        name: 'Music & DJ',
        icon: '🎵',
        group: vendors,
        owner: helper,
        startedAt: at(-5),
        currentPosition: 1,
        steps: [
          { name: 'Agree on a vibe' },
          { name: 'Shortlist DJs' },
          { name: 'Book DJ' },
        ],
      },
      {
        name: 'Flowers',
        icon: '💐',
        group: vendors,
        steps: [
          { name: 'Decide on palette' },
          { name: 'Find a florist' },
          { name: 'Confirm arrangements', deadline: day(95) },
        ],
      },
      {
        name: 'Honeymoon',
        icon: '✈️',
        owner: jeremy,
        steps: [
          { name: 'Agree on destination' },
          { name: 'Book flights', deadline: day(75) },
          { name: 'Book accommodation' },
        ],
      },
    ];

    for (const seed of workstreams) {
      await this.createWorkstream(em, project, seed);
    }

    await em.flush();
  }

  /** The pointer is released first — `current_step_id` is ON DELETE RESTRICT. */
  private async clear(em: EntityManager): Promise<void> {
    await em.nativeUpdate(Workstream, {}, { currentStep: null });
    await em.nativeDelete(Project, {});
    await em.nativeDelete(User, {});
  }

  private async createWorkstream(
    em: EntityManager,
    project: Project,
    seed: WorkstreamSeed,
  ): Promise<void> {
    const workstream = em.create(Workstream, {
      project,
      name: seed.name,
      icon: seed.icon,
      group: seed.group ?? null,
      owner: seed.owner ?? null,
      startedAt: seed.startedAt ?? null,
      completedAt: seed.completedAt ?? null,
    });

    const steps = seed.steps.map((stepSeed, index) =>
      em.create(Step, {
        workstream,
        position: index + 1,
        name: stepSeed.name,
        deadline: stepSeed.deadline ?? null,
        owner: stepSeed.owner ?? null,
        outcome: stepSeed.outcome ?? null,
        outcomeAt: stepSeed.outcomeAt ?? null,
        blocked: stepSeed.blocked ?? false,
        checklistItems: (stepSeed.checklist ?? []).map((item, itemIndex) => ({
          position: itemIndex + 1,
          name: item.name,
          done: item.done,
        })),
        notes: stepSeed.notes ?? [],
      }),
    );

    // The pointer can only be set once the steps exist — the FK is circular.
    await em.flush();

    if (seed.currentPosition !== undefined) {
      workstream.currentStep = steps[seed.currentPosition - 1] ?? null;
    }
  }
}
