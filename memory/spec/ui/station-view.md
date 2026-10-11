# Station View

Status: Active (2026-10-11)

The station is drawn as a schematic track diagram on a 1200×500 stage that scales to fill the page width edge to edge, with no border or margin, and sits vertically centred in the viewport; the top bar floats over the upper edge of the page.

Related documents:

- [Signals and blocks](../domain/signals-and-blocks.md): Source of the aspects and locks visualised here.
- [Switches and locking](../domain/switches-and-locking.md): Source of switch state and locked status.

## Elements

- **Tracks**: 6 px lines. Idle grey; light grey when route-locked for a train; red when occupied.
- **Switches**: a yellow dot at the switch node and a yellow "blade" along the selected leg; the unselected leg is visually broken near the node. Locked switches turn orange with a ring. Switch ids are not drawn.
- **Signals**: a three-lamp head (red, yellow, green top to bottom) on a short mast, drawn above or below the track per layout. Signal ids are not drawn. Only the current aspect is lit. Clicking a signal head toggles a dispatcher hold; a held signal is drawn with an orange frame and an orange stop bar across the top of the head.
- **Platforms**: a rounded bar alongside each platform track, inset by the platform margin from both track ends so a stopped train's head lines up with the end of the bar; labelled with its name in the platform's colour (P1 blue, P2 pink, P3 amber); there is no separate id badge.
- **Through line**: the centre track carries no bar, only a violet `THROUGH LINE · NO STOP` label. Through trains and their queue pills are violet.
- **Trains**: a thick line along the track from tail to head, coloured by the booked platform, with a white head marker and a label `ID → Pn`. The label shows a dwell countdown at a platform and a stop marker when held at a signal.
- **Dwell progress**: while a train stands at a platform, a thin bar under it spans the train's length and fills from tail to head in the train's colour as the dwell elapses, so the player can see at a glance when it is about to leave.
- The entrance is the `IN` signal (unlabelled like all signals). The two exits are labelled `N ▶ NORTH` and `S ▶ SOUTH`; the diamond carries no label. Train labels read `ID → track → exit`, and queue pills `ID → track/exit`.
- **Arrival lane**: above the inbound track, next to the entrance signal. Pills are equal width and coloured by booked destination.
  - _Lower band, the approach_: a vertical track line with one slot per off-stage approach section and a block-signal dot at each section boundary showing that signal's aspect. A train on the approach is drawn as a pill at its real position along the sections, so trains visibly slide down towards `IN` and stack one per section (outlined, `held`) when the entrance is blocked. The pill disappears once the train passes `IN` onto the visible track.
  - _Upper band, the timetable_: up to four pending trains; each pill starts at the top 90 s before it is due and slides down to the approach as its due time nears. Pills never overlap. Trains that are due but cannot enter the approach yet wait at the bottom of this band, outlined and marked `waiting`.
  - The header reads `NEXT`, or `NO MORE TRAINS` once the timetable is exhausted.

## Interaction

- Clicking (or tapping) within 16 px of a switch node toggles it, and within 13 px of a signal head toggles its hold. Clicks are ignored while paused or after the shift ends.
- There is no interaction with trains or platforms.
