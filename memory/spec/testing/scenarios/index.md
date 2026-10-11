# Scenario Index

Status: Active (2026-10-11)

Canonical end-to-end acceptance scenarios for high-risk flows. Each maps to tests in `src/core/__tests__/simulation.test.ts`.

Related documents:

- [Testing index](../index.md): Parent catalog for verification docs.
- [Seed S1 Central Station](../seeds/s1-central-station.md): The layout every scenario runs on.

- [GS1 Route to booked platform](gs1-route-to-booked-platform.md): A train is routed to its booked platform, dwells, departs, and is scored. Read this for the happy path and scoring assertions.
- [GS2 Hold at platform entry light](gs2-hold-at-home-signal.md): A train passes a yellow home signal and waits at a red platform entry light while the platform is occupied, locking the ladder until the platform clears. Read this for the core blocking behaviour.
- [GS3 Switch locking](gs3-switch-locking.md): Switches under a train or on its locked route refuse to move, then free up. Read this for interlocking guarantees.
- [GS6 Diamond crossing](gs6-diamond-crossing.md): Two trains want opposite diagonals of the diamond at the same moment; only one may cross. Read this for crossing conflicts and the same-step aspect refresh.
- [GS5 Entrance queue](gs5-entrance-queue.md): Trains back up through the home and entrance signals when the station is blocked, the last one waiting off stage. Read this for the entrance-signal behaviour.
- [GS4 Through train](gs4-through-train.md): A through train runs the centre line without stopping, or is diverted through a platform and penalised. Read this for the non-stopping rules.
