import { Seeder } from '@mikro-orm/seeder';

import { Group } from '@/database/entities/group.entity';
import { ProjectMember } from '@/database/entities/project-member.entity';
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

/** Overridable so a developer's own account can own the fixture project locally. */
const DEFAULT_SEED_OWNER_EMAIL = 'mock@example.com';

const MOCK_PARTNER_EMAIL = 'mock-partner@example.com';

/**
 * Development fixture covering every lifecycle, step status and deadline
 * urgency band the overview renders. Dates are relative to the run date.
 */
export class LocalDatabaseSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    await this.clear(em);

    const user = this.userFactory(em);
    const jeremy = user('jeremy@example.com', 'Jeremy');
    const partner = user('partner@example.com', 'Alex Doe');
    const helper = user('helper@example.com', 'Sam Reed');
    const owner = user(
      process.env.SEED_OWNER_EMAIL ?? DEFAULT_SEED_OWNER_EMAIL,
      'MockUser',
    );
    const mockPartner = user(MOCK_PARTNER_EMAIL, 'MockPartner');

    const project = em.create(Project, {
      name: 'Wedding Prep',
      eventDate: day(147),
      owner,
    });
    this.addMembers(em, project, [owner, jeremy, partner, helper]);

    const secondProject = em.create(Project, {
      name: 'Birthday Bash',
      eventDate: day(38),
      owner: mockPartner,
    });
    this.addMembers(em, secondProject, [mockPartner]);

    const logistics = em.create(Group, {
      project,
      position: 0,
      name: 'Logistics',
      color: '#8b6cc1',
    });
    const foodAndDrink = em.create(Group, {
      project,
      position: 1,
      name: 'Food & Drink',
      color: '#e09850',
    });
    const vendors = em.create(Group, {
      project,
      position: 2,
      name: 'Vendors',
      color: '#5a9e6f',
    });
    const attire = em.create(Group, {
      project,
      position: 3,
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

    const positionsByScope = new Map<string, number>();
    for (const seed of workstreams) {
      const scope = seed.group?.id ?? 'ungrouped';
      const position = positionsByScope.get(scope) ?? 0;
      positionsByScope.set(scope, position + 1);

      await this.createWorkstream(em, project, seed, position);
    }

    await em.flush();
  }

  /**
   * Two restrictive FKs dictate the order: `workstream.current_step_id` is
   * released before its steps go, and users outlive the projects they own.
   * Member rows cascade with the project.
   */
  private async clear(em: EntityManager): Promise<void> {
    await em.nativeUpdate(Workstream, {}, { currentStep: null });
    await em.nativeDelete(Project, {});
    await em.nativeDelete(User, {});
  }

  /** Keeps one row per email — the seed owner may be one of the fixture users. */
  private userFactory(
    em: EntityManager,
  ): (email: string, name: string) => User {
    const byEmail = new Map<string, User>();

    return (email, name) => {
      const normalized = email.toLowerCase();
      const existing = byEmail.get(normalized);

      if (existing) {
        return existing;
      }

      const created = em.create(User, {
        email: normalized,
        name,
        avatarUrl: null,
      });
      byEmail.set(normalized, created);

      return created;
    };
  }

  /** The owner always has a member row, so membership alone answers "who can access". */
  private addMembers(
    em: EntityManager,
    project: Project,
    users: readonly User[],
  ): void {
    const distinctUsers = new Set(users);

    for (const member of distinctUsers) {
      em.create(ProjectMember, {
        project,
        email: member.email,
        user: member,
      });
    }
  }

  private async createWorkstream(
    em: EntityManager,
    project: Project,
    seed: WorkstreamSeed,
    position: number,
  ): Promise<void> {
    const workstream = em.create(Workstream, {
      project,
      position,
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
