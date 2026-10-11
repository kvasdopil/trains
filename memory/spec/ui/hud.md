# HUD

Status: Active (2026-10-11)

The DOM side panel and top bar give the player the timetable and feedback that the canvas does not.

Related documents:

- [Timetable and scoring](../domain/timetable-and-scoring.md): Source of the values shown here.

## Top bar

- Floats over the top of the game field (no band, border or margin of its own): title, the money counter, the pause/speed/restart controls and the two side-panel toggles. There is no shift clock; event times in the log are the only visible times.
- The money counter (`$1,230`, `-$40`) counts towards each new balance over ~0.6 s (GSAP) and flashes green when money rises, red when it falls, fading back to the normal text colour. It snaps to `$0` on restart. There is no trains-left counter; the canvas queue shows `+N MORE` above the stack of upcoming trains when not all of them fit.
- Controls: Pause/Resume (also Space), speed cycle `1x → 2x → 4x`, Restart (new seed).

## Side panel

The side panel has three states: `none` (default), `timetable`, or `log`. Two toggle buttons, `Timetable` and `Log`, sit at the right end of the floating top bar; clicking one opens that panel on the right, clicking the active one closes it, so at most one list is visible. In the `none` state no panel is shown and the buttons float over the right edge of the stage. Only the visible list is re-rendered. There is no help text in the panel.

- **Timetable**: one row per scheduled train in arrival order with id, booked destination badge (platform colour, or violet `T` for a through train), booked exit (`→N` / `→S`), and status: `due mm:ss`, `waiting for entry track`, `approaching`, `held at signal`, `at Pn · Ns`, `waiting to depart`, `departing`, or the final result (`Pn/N ✓ +$100`, `Pn/S ✗ +$0`, with lateness; the amount is the train's net `earned`); a row is green only when both track and exit were right.
- **Log**: the last eight simulation events, newest first (arrivals, stops, departures, through-line passes and wrong-track passes, exits with net money, switch changes, refused toggles, signal holds and releases). Money coin events are not logged; they appear as popups on the canvas.

## End of shift

- When every train has left, an overlay shows the final balance, how many trains were routed correctly, and how many ran late, with a button to start a new shift.

## Money popups (canvas)

Each money event becomes a floating label on the canvas, animated with GSAP: green `+$10` pops off a random point along the train body and floats up as it fades (unloading, running through); red `-$2` rises from the train head (lateness); red `-$10` refund labels (missed stop, wrong exit) fly back into the station from the exit point, one after another, as the train crosses it. Popups animate in real time, independent of game speed.
