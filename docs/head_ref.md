# Head Referee UI Design Guidelines

**Route:** `/event/$eventcode/hr/field/$field` or `/event/$eventcode/hr/field/all`

This document contains the ASCII/Markdown UI design guidelines for the Head Referee interface, separated into its four main tabs:
1. Active Match
2. Notes
3. Timers
4. Scoresheets

---

## 1. Active Match Tab

Provides a real-time view of the ongoing match, scores, and foul inputs for the head referee. Based on the custom scoring structure.

```text
+---------------------------------------------------------------------------------------------------+
| << Back                                        Fullscreen                                    Help |
|                                                                                                   |
|                                     Head Referee (All Fields)                                     |
|                                                                                                   |
|  [ Active Match ]   Notes     Timers     Scoresheets                                              |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|                                          Playoff Match 3                                          |
|                                              Field: 1                                             |
|                                       Match Status: Unplayed                                      |
|                                                                                                   |
| [Flip Alliances]                       [  Review Required?  ]                          [Add Note] |
|                                                                                                   |
+---------------------------------+---------------------------------+-------------------------------+
|               Blue              |          Referee Status         |              Red              |
+---------------------------------+---------------------------------+-------------------------------+
|               INIT              |          Scoring Phase          |              INIT             |
|                                 |                                 |                               |
|   +-------------------------+   |           MINOR FOULS           |   +-----------------------+   |
|   |            1            |   |              Total              |   |           0           |   |
|   +-------------------------+   |         Foul input: R / B       |   +-----------------------+   |
|                                 |                                 |                               |
|              0 / 0              |          HR MINOR FOULS         |             0 / 0             |
|     [ - ]      1      [ + ]     |                                 |    [ - ]      0      [ + ]    |
|                                 |                                 |                               |
|   +-------------------------+   |           MAJOR FOULS           |   +-----------------------+   |
|   |            0            |   |              Total              |   |           0           |   |
|   +-------------------------+   |         Foul input: R / B       |   +-----------------------+   |
|                                 |                                 |                               |
|              0 / 0              |          HR MAJOR FOULS         |             0 / 0             |
|     [ - ]      0      [ + ]     |                                 |    [ - ]      0      [ + ]    |
+---------------------------------+---------------------------------+-------------------------------+
|                                                                                                   |
| [ ▼ Normal Scores ▼ ]                                                                             |
|                                                                                                   |
|   +-------------------------+   |      A — Số cờ được bảo vệ      |   +-----------------------+   |
|   |            0            |   |            Cờ tầng 2            |   |           0           |   |
|   +-------------------------+   |          25 điểm / 1            |   +-----------------------+   |
|                                 |                                 |                               |
|   +-------------------------+   |            Cờ tầng 1            |   +-----------------------+   |
|   |            0            |   |          20 điểm / 1            |   |           0           |   |
|   +-------------------------+   |                                 |   +-----------------------+   |
|                                 |                                 |                               |
|   +-------------------------+   |           Cờ trung tâm          |   +-----------------------+   |
|   |            0            |   |          10 điểm / 1            |   |           0           |   |
|   +-------------------------+   |                                 |   +-----------------------+   |
|                                 |                                 |                               |
|   +-------------------------+   | B — Bắn phá trên sân đối phương |   +-----------------------+   |
|   |            0            |   |       Bắn hạ cờ trung tâm       |   |           0           |   |
|   +-------------------------+   |          30 điểm / 1            |   +-----------------------+   |
|                                 |                                 |                               |
|   +-------------------------+   |          Bắn hạ cờ khác         |   +-----------------------+   |
|   |            0            |   |          10 điểm / 1            |   |           0           |   |
|   +-------------------------+   |                                 |   +-----------------------+   |
|                                 |                                 |                               |
|   +-------------------------+   |  C — Số đạn trên sân đối phương |   +-----------------------+   |
|   |            0            |   |  Số đạn trên sân đối phương     |   |           0           |   |
|   +-------------------------+   |           loại bỏ cờ            |   +-----------------------+   |
|                                 |                                 |                               |
|                                 | D — Giai đoạn kết thúc trận đấu |                               |
|             Không               |            Vị trí đỗ            |             Không             |
|                                 |                                 |                               |
|   +-------------------------+   |         Bảo vệ cờ vàng          |   +-----------------------+   |
|   |            0            |   |          10 điểm / 1            |   |           0           |   |
|   +-------------------------+   |                                 |   +-----------------------+   |
|                                 |                                 |                               |
|          Total Score            |                                 |          Total Score          |
|              0                  |                                 |              0                |
+---------------------------------+---------------------------------+-------------------------------+
|                                                                                                   |
|                                           Teams / Cards                                           |
|                                                                                                   |
|   +-------------------------+                                         +-----------------------+   |
|   |            8            |                                         |           5           |   |
|   +-------------------------+            [ Assign Cards ]             +-----------------------+   |
|   |            3            |                                         |           2           |   |
|   +-------------------------+                                         +-----------------------+   |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

**Key Features (Active Match):**
*   **Realtime Sync:** Scores update synchronously in real-time. Head ref can see the outcome as it changes.
*   **Fouls and Cards Control:** Head referee exclusively controls (increment/decrement) Minor and Major fouls for both Blue and Red alliances, and can assign cards.
*   **Normal Scores (Read-only):** Head referee can view the normal gameplay scores sections (A-D) as defined by the event rules, preferably placed inside a toggleable accordion `[ ▼ Normal Scores ▼ ]` without edit controls.
    *   **A:** Cờ tầng 2 (25pts), Cờ tầng 1 (20pts), Cờ trung tâm (10pts).
    *   **B:** Bắn hạ cờ trung tâm (30pts), Bắn hạ cờ khác (10pts).
    *   **C:** Số đạn trên sân đối phương (Cancels flags / -10pts).
    *   **D:** Vị trí đỗ (Không: 0pts, Một phần: 10pts, Toàn bộ: 15pts), Bảo vệ cờ vàng (10pts).
*   **Notes:** Quick access to the `[Add Note]` feature.
*   **Overview:** View current match metadata (Match name, Field, Status). The previous randomization is removed.

---

## 2. Notes Tab

Allows the Head Referee to review and manage notes organized by match, by team, or meetings.

```text
+---------------------------------------------------------------------------------------------------+
| << Back                                        Fullscreen                                    Help |
|                                                                                                   |
|                                     Head Referee (All Fields)                                     |
|                                                                                                   |
|    Active Match   [ Notes ]   Timers     Scoresheets                                              |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|                              [ By Match ]   [ By Team ]   [ Meeting ▼ ]                           |
|                                                                                                   |
|                          Tap on a row to open the notes for that match.                           |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
| Match                                             Notes                                           |
+---------------------------------------------------------------------------------------------------+
| Q1                                                                                                |
+---------------------------------------------------------------------------------------------------+
| Q2                                                                                                |
+---------------------------------------------------------------------------------------------------+
| Q3                                                                                                |
+---------------------------------------------------------------------------------------------------+
| Q4                                                                                                |
+---------------------------------------------------------------------------------------------------+
| Q5                                                                                                |
+---------------------------------------------------------------------------------------------------+
| Q6                                                                                                |
+---------------------------------------------------------------------------------------------------+
| Q7                                                                                                |
+---------------------------------------------------------------------------------------------------+
```

**Key Features (Notes):**
*   **Filters/Views:** Toggle between notes sorted `[By Match]`, `[By Team]`, or grouped by `[Meeting ▼]`.
*   **List View:** Tabular display showing the Match number and a snippet of the Notes.
*   **Interactivity:** Tapping on any row expands or opens the detailed notes for that specific match/team.

---

## 3. Timers Tab

Displays relevant timing information, such as current device time, and match start/end scheduling.

```text
+---------------------------------------------------------------------------------------------------+
| << Back                                        Fullscreen                                    Help |
|                                                                                                   |
|                                     Head Referee (All Fields)                                     |
|                                                                                                   |
|    Active Match     Notes   [ Timers ]   Scoresheets                                              |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|                                         G301 Timing - M3                                          |
|                                         Red: A1 Blue: A2                                          |
|                                                                                                   |
|        Match start time has passed!                           [ Start 2-Minute Warning ]          |
|                                                                                                   |
|---------------------------------------------------------------------------------------------------|
|                                                                                                   |
|                                            All Timing                                             |
|                                      Current time: 22:06:29                                       |
|                                                                                                   |
| M    Type                    Start      Length    End        Left                                 |
| M3   Scheduled Time                               09:27:00   0:00                                 |
| M3   A1 Last Match (M1)      09:21:27   8:00      09:29:27  [0:00]                                |
| M4   Scheduled Time                               09:33:00   0:00                                 |
| M4   A4 Last Match (M1)      09:21:27   8:00      09:29:27   0:00                                 |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

**Key Features (Timers):**
*   **Current Time:** Displays local device time continuously (`Current time: HH:MM:SS`).
*   **Match Timing Info:** Displays tables with `Match (M)`, `Type`, `Start`, `Length`, `End`, and time `Left` columns.
*   **Warnings/Actions:** Quick access button to `[ Start 2-Minute Warning ]`. Highlights critical times visually (e.g., green highlight on the 'Left' value).

---

## 4. Scoresheets Tab

Provides a read-only or review view of the detailed scoresheets directly from the UI, utilizing the custom `Scoresheet` matching the event's scoring metrics.

```text
+---------------------------------------------------------------------------------------------------+
| << Back                                        Fullscreen                                    Help |
|                                                                                                   |
|                                     Head Referee (All Fields)                                     |
|                                                                                                   |
|    Active Match     Notes     Timers   [ Scoresheets ]                                            |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|                              Match: [ M1 ▼ ]     Playoff Only: [ ]                                |
|                                                                                                   |
|                               ( ) Red    ( ) Blue    (•) Both                                     |
|                                                                                                   |
|                                                                                                   |
|             +------------------------------+               +------------------------------+       |
|             |         Blue Alliance        |               |          Red Alliance        |       |
|             +------------------------------+               +------------------------------+       |
|                                                                                                   |
|                 Match: __M1__ Field: __1__                     Match: __M1__ Field: __1__         |
|                                                                                                   |
|             +------------------------------+               +------------------------------+       |
|             |     A — Số cờ được bảo vệ    |               |     A — Số cờ được bảo vệ    |       |
|             +------------------------------+               +------------------------------+       |
|             | Cờ tầng 2                 0  |               | Cờ tầng 2                 0  |       |
|             | 25 điểm / 1                  |               | 25 điểm / 1                  |       |
|             | Cờ tầng 1                 0  |               | Cờ tầng 1                 0  |       |
|             | 20 điểm / 1                  |               | 20 điểm / 1                  |       |
|             | Cờ trung tâm              0  |               | Cờ trung tâm              0  |       |
|             | 10 điểm / 1                  |               | 10 điểm / 1                  |       |
|             +------------------------------+               +------------------------------+       |
|             | B — Bắn phá trên sân đối ... |               | B — Bắn phá trên sân đối ... |       |
|             +------------------------------+               +------------------------------+       |
|             | Bắn hạ cờ trung tâm       0  |               | Bắn hạ cờ trung tâm       0  |       |
|             | 30 điểm / 1                  |               | 30 điểm / 1                  |       |
|             | Bắn hạ cờ khác            0  |               | Bắn hạ cờ khác            0  |       |
|             | 10 điểm / 1                  |               | 10 điểm / 1                  |       |
|             +------------------------------+               +------------------------------+       |
|             | C — Số đạn trên sân đối p... |               | C — Số đạn trên sân đối p... |       |
|             +------------------------------+               +------------------------------+       |
|             | Số đạn trên sân đối phương 0 |               | Số đạn trên sân đối phương 0 |       |
|             | loại bỏ cờ                   |               | loại bỏ cờ                   |       |
|             +------------------------------+               +------------------------------+       |
|             | D — Giai đoạn kết thúc tr... |               | D — Giai đoạn kết thúc tr... |       |
|             +------------------------------+               +------------------------------+       |
|             | Vị trí đỗ              Không |               | Vị trí đỗ              Không |       |
|             | Không                        |               | Không                        |       |
|             | Bảo vệ cờ vàng            0  |               | Bảo vệ cờ vàng            0  |       |
|             | 10 điểm / 1                  |               | 10 điểm / 1                  |       |
|             +------------------------------+               +------------------------------+       |
|             | Tổng điểm                    |               | Tổng điểm                    |       |
|             |                              |               |                              |       |
|             | 0                            |               | 0                            |       |
|             +------------------------------+               +------------------------------+       |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+

