FTC Live App - ASCII Display Wireframes (1v1 Format)
This document contains ASCII wireframes for the 9 display scenes defined in the display control workflow, specifically adapted for a 1v1 event format (one red robot vs one blue robot).

1. Next Match Screen
Displayed when the control page queues the next match. Shows the upcoming match start countdown.

text
+-----------------------------------------------------------------------------+
| [ ]                   National Robotics Competition                 (Gear)  |
|                                                                             |
|                                                                             |
|                                 +-------+                                   |
|                                 |   /   |                                   |
|                                 |  /    |  (Event Logo / Clock)             |
|                                 | /     |                                   |
|                                 +-------+                                   |
|                                                                             |
|                                                                             |
|                                                                             |
|                                                                             |
|               +---------------------------------------------+               |
| [Puzz]        |  Next match expected start:      0:00       |        [Hour] |
+-----------------------------------------------------------------------------+
2. Match Preview Screen
Displays the upcoming match details right before match start. Adapted for 1 vs 1 by removing the secondary team slots.

text
+-----------------------------------------------------------------------------+
| Up Next                     Qualification 4 of 5                            |
+--------------------------------------+--------------------------------------+
|                                      |                                      |
|                                      |                                      |
|  +-------------------------------+   |   +-------------------------------+  |
|  |  [Icon]  1234                 |   |   |  [Icon]  5678                 |  |
|  |  Red Team Name                |  VS   |  Blue Team Name               |  |
|  +-------------------------------+   |   +-------------------------------+  |
|                                      |                                      |
|                                      |                                      |
|                                      |                                      |
+--------------------------------------+--------------------------------------+
| [NRC]    EVENT NAME                                                         |
+-----------------------------------------------------------------------------+
3. Match Start Screen
Live scoreboard during the match. Timer runs down; standard lower-thirds scoreboard. Modified for 1 team per side with A, B, C, D breakdown.

text
+-----------------------------------------------------------------------------+
|                                    Field 1                          (Gear)  |
|                                                                             |
|                                                                             |
|                           +-----------------------+                         |
|                           |                       |                         |
|                           |       2 : 3 0         |                         |
|                           |                       |                         |
|                           +-----------------------+                         |
|                                                                             |
|                                  ( o o o )                                  |
|                                                                             |
+-----------------------------------------------------------------------------+
| [NRC]   |  EVENT NAME         |  Qualification 4 of 5            |          |
+---------+----------+----------+------------------+----------+----+----------+
|   RED   |   1234   |    RED   |        VS        |   BLUE   |   5678   |BLUE|
|   55    |          |    55    |                  |    85    |          | 85 |
| A:15 B:20 C:10 D:10|          |                  |          | A:40 B:20 C:10 D:15 |
+---------+----------+----------+------------------+----------+----+----------+
4. Match Winner Screen
Displays the final score and winner highlight at the end of a match. Contains a breakdown of scoring categories (A, B, C, D).

text
+------------------------------------------------------------------------------+
| Match Results               Qualification 4 of 5                             |
+--------------------------------------+-------------------------------------- +
|                  RED                 |                 BLUE                  |
|                   55                 |                  85    [WINNER (Y)]   |
|                                      |                                       |
|                            +-------------------+                             |
|                            | 15  A-CỜ BẢO VỆ 40|                             |
|                            | 20    B-BẮN PHÁ   20|                           |
| +---------------------+    | 10 C-ĐẠN TRÊN SÂN 10|    +---------------------+|
| | [Icon] 1234      55 |    | 10    D-ENDGAME   15|    | [Icon] 5678      85 ||
| +---------------------+    |  0      FOUL       0|    +---------------------+|
|                            +-------------------+                            |
|                                      |                                      |
|      Ranking Points                  |            Ranking Points            |
|    (Y) (Y) (Y) [R] (O)               |          (Y) (Y) (Y) [R] (O)         |
+--------------------------------------+--------------------------------------+
| [NRC]     |   3:39   | EVENT NAME                                           |
+-----------------------------------------------------------------------------+
5. Blank Screen
A standby screen that is clean and minimal, often hiding the lower thirds or specific match data.

text
+-----------------------------------------------------------------------------+
| [ ]                   National Robotics Competition                 (Gear)  |
|                                                                             |
|                                                                             |
|                                                                             |
|                                 +-------+                                   |
|                                 |   /   |                                   |
|                                 |  /    |  (Event Logo / Clock)             |
|                                 | /     |                                   |
|                                 +-------+                                   |
|                                                                             |
|                                                                             |
|                                                                             |
|                                                                             |
|                                                                             |
| [Puzz]                                                               [Hour] |
+-----------------------------------------------------------------------------+
6. Ranking Screen
Shows the current leaderboard status with 7 columns.

text
+-----------------------------------------------------------------------------+
|                                                                     (Gear)  |
|                                                                             |
|  Rank | Team | Name             | RP | Total | W-L-T | % Win                  |
| +-------------------------------------------------------------------------+ |
| |  1  | 5678 | Blue Team Name   | 2  |   45  | 1-0-0 | 100%               | |
| |  2  | 1234 | Red Team Name    | 0  |   15  | 0-1-0 |   0%               | |
| |  3  | 9012 | Another Team     | 0  |    0  | 0-0-0 |   0%               | |
| |  4  | 3456 | Yet Another Team | 0  |    0  | 0-0-0 |   0%               | |
| +-------------------------------------------------------------------------+ |
|                                                                             |
|                                                                             |
|                                                                             |
|  5 matches per team                                   3 / 5 matches played  |
+-----------------------------------------------------------------------------+
|          TEST                                                               |
|                                                                             |
+-----------------------------------------------------------------------------+
7. Match Results Screen
Shows the results of the recently completed matches for 1v1 format.

text
+-----------------------------------------------------------------------------+
|                                                                     (Gear)  |
|                                                                             |
|                Red Team              RD    BD              Blue Team        |
| +-------------------------------------------------------------------------+ |
| | Q1 | 1234 - Red Team Name        | 15  - 45 | 5678 - Blue Team Name     | |
| | Q2 | 9012 - Another Team         |  0  -  0 | 3456 - Yet Another Team   | |
| | Q3 |                             |          |                           | |
| | Q4 |                             |          |                           | |
| +-------------------------------------------------------------------------+ |
|                                                                             |
|                                                                             |
|                                                                             |
|                                                                             |
|                                                       3 / 5 matches played  |
+-----------------------------------------------------------------------------+
|          TEST                                                               |
|                                                                             |
+-----------------------------------------------------------------------------+
Checklist indicating which robots have passed safety and technical inspections.

text
+-----------------------------------------------------------------------------+
| +-------------------------------+                                   (Gear)  |
| | Name   | Robot Inspection     |                                           |
| | Symbol |       R              |                                           |
| +-------------------------------+                                           |
| +-------------------------------------------------------------------------+ |
| |  R  | Team | Name                                                       | |
| +-------------------------------------------------------------------------+ |
| | [Y] | 1234 | Red Team Name                                              | |
| | [G] | 5678 | Blue Team Name                                             | |
| | [C] | 9012 | Another Team                                               | |
| |     | 3456 | Yet Another Team                                           | |
| +-------------------------------------------------------------------------+ |
|                                                                             |
|                +----------------------------------------------------------+ |
|                | Status | Not Started | In Progress | Passed | Ready |... | |
|                | Color  |  [Black]    |  [Cyan]     | [Green]|[Orange]  | |
|                +----------------------------------------------------------+ |
+-----------------------------------------------------------------------------+
|          TEST                                                               |
|                                                                             |
+-----------------------------------------------------------------------------+
8. Text Notification Screen
An overlay used for communicating specific text instructions to the audience, such as delays.

text
+-----------------------------------------------------------------------------+
|                                                                     (Gear)  |
|                                                                             |
|                                                                             |
|                   +------------------------------------+                    |
|                   |                                    |                    |
|                   |                                    |                    |
|                   |        Wait for Next match         |                    |
|                   |                                    |                    |
|                   |                                    |                    |
|                   +------------------------------------+                    |
|                                                                             |
|                                                                             |
+-----------------------------------------------------------------------------+
|          TEST                                                               |
|                                                                             |
+-----------------------------------------------------------------------------+
9. Sponsor Screen
A blank screen showcasing event sponsors.

text
+-----------------------------------------------------------------------------+
| [ ]                   National Robotics Competition                 (Gear)  |
|                                                                             |
|                                                                             |
|                                                                             |
|                                                                             |
|                                                                             |
|                                Nha tai tro                                  |
|                                                                             |
|                [ Logo 1 ]       [ Logo 2 ]       [ Logo 3 ]                 |
|                                                                             |
|                                                                             |
|                                                                             |
|                                                                             |
|                                                                             |
| [Puzz]                                                               [Hour] |
+-----------------------------------------------------------------------------+