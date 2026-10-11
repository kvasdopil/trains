# Roadmap

Status: Draft (2026-10-11)

Ordered initiatives for Rails Dispatcher. Only EP-001 is planned in detail; later items are candidates, not commitments.

Related documents:

- [EP-001 Station dispatcher core](epics/EP-001-station-dispatcher/index.md): The first playable release. Read this for the current scope.
- [Game overview](../spec/project/overview.md): Product frame and explicit non-goals.

## Sequence

1. **EP-001 Station dispatcher core** — station outline, switches, automatic signals, arriving trains routed to platforms, scoring. _In progress; FT-0001 delivered._
2. Candidate: difficulty ramp and shift length options; gridlock detection (a train waiting too long ends the shift). Bunched arrivals (several trains in the station at once) are already in the default timetable.
3. **Through trains** — centre through line and non-stopping services. _Delivered in FT-0002._
4. Candidate: freight that needs a specific siding and occupies it for a long time.
5. Candidate: bidirectional running on a second inbound/outbound pair.
6. Candidate: manual route setting (click signal to request a route) as an alternative control scheme.
7. Candidate: additional stations loaded from layout files.
