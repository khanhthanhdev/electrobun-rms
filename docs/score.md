Quy tắc ghi điểm
Tổng điểm bao gồm các loại điểm thành phần sau (được kí hiệu bằng chữ cái trong ngoặc)
- Điểm của số lúa được bảo vệ thành công (A)
- Điểm phân bón rơi vào ô đích trong Chung kết (B)
- Điểm bảo vệ thành công Cây Lúa Vàng đến cuối trận (C)
- Điểm robot đỗ vào Vị trí Xuất phát khi kết thúc (D)
- Điểm trừ: Cây lúa sau khi cắm tại khu vực Kho thóc bị rơi trong thời gian thi đấu

| **Criteria**                                                                         | **Points**                      |
| ------------------------------------------------------------------------------------ | ------------------------------- |
| Mỗi cây lúa Tầng 2 được bảo vệ hợp lệ tại Khu vực Đích khi kết thúc (A)               | 2 điểm / cây                    |
| Mỗi cây lúa Tầng 1 được bảo vệ hợp lệ tại Khu vực Đích khi kết thúc (A)               | 1 điểm / cây                    |
| Cây lúa Trung Tâm được bảo vệ hợp lệ khi kết thúc (A)                                  | 2 điểm / cây                    |
| Phân bón rơi vào ô đích — Chung kết (B), tối đa 10 viên / đội / trận                  | +1 điểm / viên (max +10)        |
| Robot đỗ hoàn toàn vào Vị trí Xuất phát khi kết thúc (D)                               | 3 điểm / robot                  |
| Robot đỗ không hoàn toàn vào Vị trí Xuất phát khi kết thúc (D)                         | 2 điểm / robot                  |
| Bảo vệ thành công Cây Lúa Vàng đến cuối trận (Endgame) (C)                             | 5 điểm / cây lúa đứng tại Căn cứ |
| Cây lúa sau khi cắm tại khu vực Kho thóc bị rơi trong thời gian thi đấu                | -1 điểm / cây                   |


Design guide:
- Điểm robot đỗ (vị trí đỗ) dùng 3 button: "Không" (0pts), "Không hoàn toàn" (2pts), "Hoàn toàn" (3pts)
- Các điểm còn lại dùng button -/+ để tăng giảm

Score Summary:
A - Lúa bảo vệ
B - Phân bón vào ô đích (max 10 điểm)
C - Lúa vàng
D - Vị trí đỗ
Penalty - Cây lúa sau khi cắm tại Kho thóc bị rơi (-1 điểm / cây)

Tính toán:
- Score A = (flagsL2Defended × 2) + (flagsL1Defended × 1) + (flagsCenterDefended × 2)
- Score B = Math.min(10, fertilizerCount) × 1
- Score C = goldenFlagsBonus × 5
- Score D = parkingBonus
  - parkingBonus: 0=không, 1=không hoàn toàn (2pts), 2=hoàn toàn (3pts)
- Penalty = droppedPlantedRice × 1
- Total = max(0, A + B + C + D - Penalty)  [không âm, tối thiểu 0]

Tổng điểm tối đa: ~40 điểm. Tổng điểm cuối tối thiểu là 0 (không âm).


Đề bài sơ lược
Trong trò chơi "Gặt Mùa Vàng Điện Biên", hai đội sẽ điều khiển Robot tham gia hành trình tái hiện hình ảnh những người nông dân trên cánh đồng Mường Thanh huyền thoại. Mỗi đội gồm đúng 5 học sinh với các vai trò chuyên biệt — cùng nhau vận chuyển từng cây lúa từ cánh đồng về Kho thóc, xếp chồng tạo nên hình ảnh biểu tượng cánh đồng Điện Biên.
(*) Người điều khiển Robot không quan sát trực tiếp mà phải dựa vào Camera gắn trên Robot và sự phối hợp từ đồng đội — tái hiện một môi trường công nghệ cao, thử thách khả năng giao tiếp và chiến thuật theo thời gian thực.


Phần 2: Tổng quan thi đấu
Thời lượng và cấu trúc trận đấu
Thông số
Chi tiết
Thời lượng trận đấu
8 phút (480 giây) cho mỗi trận đấu
Giai đoạn Endgame
2 phút cuối (từ 2:00 còn lại đến kết thúc)
Mở khóa phân bón (Chung kết)
Sau 4 phút kể từ khi bắt đầu, hoặc sớm hơn nếu hoàn thành điều kiện mở khóa.
Số học sinh / đội
Đúng 5 học sinh THPT (2 Driver + 1 Chỉ Huy + 2 Human Player)
Số đội / trận
2 đội (đối đầu trực tiếp 1 vs 1)


Giới thiệu về trò chơi
Trong mỗi trận đấu 8 phút, hai đội điều khiển Robot thực hiện nhiệm vụ vận chuyển cây lúa từ Khu vực Cánh Đồng về Khu vực Đích. Robot xuất phát tại Vị trí xuất phát ở đầu trận.

Cấu trúc Khu vực Cánh Đồng:
Tầng 1 (thấp): chứa 12 cây lúa — mỗi cây trị giá 1 điểm.
Tầng 2 (cao): chứa 8 cây lúa — mỗi cây trị giá 2 điểm.

Dòng thời gian trận đấu:
0:00 — 6:00: Giai đoạn chính. Robot vận chuyển cây lúa, Chỉ Huy điều phối chiến thuật.
4:00 — Điều kiện mở khóa phân bón: Nếu đội hoàn thành 2 cây lúa Tầng 1 hoặc 1 cây lúa Tầng 2 hợp lệ, Human Player 1 được phép nạp phân bón vào Robot (chỉ Chung kết).
Phút 4:00 tự động: Nếu điều kiện chưa đạt, phân bón được mở khóa tự động sau 4 phút kể từ khi bắt đầu (chỉ Chung kết).
6:00 — Endgame bắt đầu: Robot hai phe có quyền tranh đoạt 1 cây Lúa Vàng đặc biệt đặt tại Khu chứa thóc.
8:00 — Kết thúc trận: Tất cả ghi điểm dừng lại. Robot phải đứng yên hoàn toàn.

📌 Lưu ý: Người điều khiển Robot (Driver và Cơ Cấu) chỉ quan sát qua màn hình Camera. Chỉ Huy, Human Player 1 và Human Player 2 là cầu nối thông tin giữa sân đấu và Trạm Điều Khiển.


Các thành phần trong sân thi đấu
Khu vực Cánh Đồng: Hình tròn ở chính giữa sân, chứa cây lúa 2 tầng.
Khu vực Đích (Kho thóc): Hình chữ nhật ở cuối sân, nơi Robot cắm cây lúa.
Vị trí Xuất phát: Ô vuông đánh dấu rõ ràng, sát cạnh Khu vực Đích.
Khu vực Chướng ngại vật: Nằm giữa sân, chứa các cột trụ Robot phải vượt qua.
Điểm Tiếp tế (Chung kết): Vị trí được đánh dấu gần sân của đội, nơi Human Player 1 nạp phân bón vào Robot.
Khu vực Quan sát HP1: Khu vực dành riêng cho Human Player 1 đứng, phía Cánh Đồng.
Khu vực Quan sát HP2: Khu vực dành riêng cho Human Player 2 đứng, phía Kho thóc.

Các định nghĩa trong game đấu
Cây lúa: Vật phẩm tranh đoạt chính, đế hình tròn, cao 250mm, đường kính 55mm, bằng nhựa.
Đạn (phân bón): Viên bi tròn nhỏ (đường kính ~74mm, nhựa nhẹ/xốp màu xanh lá). Chỉ dùng ở Chung kết. Human Player 1 nạp; Robot bắn vào sân nhà. Mỗi viên rơi vào ô đích ghi +1 điểm dinh dưỡng, tối đa 10 viên/đội/trận.
Đỗ (Parking): Driver điều khiển Robot trở về Vị trí Xuất phát, với toàn bộ hoặc một phần hình chiếu Robot nằm trong Vị trí Xuất phát trước khi hết giờ.
Cây Lúa Vàng: Cây lúa đặc biệt xuất hiện ở Endgame (phút 6:00). Ghi điểm cao khi bảo vệ được đến cuối trận.
