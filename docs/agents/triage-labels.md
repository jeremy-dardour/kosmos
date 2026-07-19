# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those
roles to the actual strings used in this repo's issue tracker. Because the
tracker is local markdown, a "label" is just the value written on a `Status:`
line in the issue file (see [issue-tracker.md](./issue-tracker.md)).

| Canonical role    | String in our tracker | Meaning                                  |
| ----------------- | --------------------- | ---------------------------------------- |
| `needs-triage`    | `needs-triage`        | Maintainer needs to evaluate this issue  |
| `needs-info`      | `needs-info`          | Waiting on reporter for more information |
| `ready-for-agent` | `ready-for-agent`     | Fully specified, ready for an AFK agent  |
| `ready-for-human` | `ready-for-human`     | Requires human implementation            |
| `wontfix`         | `wontfix`             | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), write the
corresponding string from this table on the issue's `Status:` line.

Edit the right-hand column to match whatever vocabulary you actually use.
