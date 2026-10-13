# Word packs

Word packs are lists of word **pairs** grouped by theme. They live in the repo as JSON
files (`words/*.json`, one theme per file); friends add pairs by opening a PR, and they are
live once merged. How pairs are drawn during a game is in [the rules](../rules.md#words).

## What makes a good pair

- Same kind of thing, sharing 2–3 easy-to-describe traits and differing in 1–2 details
  (*Trà sữa / Cà phê sữa*, *Đà Lạt / Sa Pa*).
- Not synonyms (*Xác / Thân thể* is too hard) and not too far apart (*Con chó / Máy tính*
  gives the spy away at once).
- Everyone in the group knows both words.
- Nobody in the group would be uncomfortable seeing it, especially inside-joke pairs about
  group members.

## Themes

20 themes, 302 pairs (2026-10-14). The host turns themes on and off in the lobby; all are on by default.

| Theme | File | Pairs | Examples |
| --- | --- | --- | --- |
| 🍜 Đồ ăn | `food` | 17 | Phở / Bún bò · Bánh mì / Bánh bao · Cà rốt / Khoai lang |
| 🧋 Đồ uống | `drinks` | 15 | Trà sữa / Cà phê sữa · Nước cam / Nước chanh · Bạc xỉu / Cà phê muối |
| 📍 Địa điểm | `places` | 16 | Đà Lạt / Sa Pa · Khách sạn / Homestay · Biển / Hồ bơi |
| 🏠 Trong nhà | `home` | 15 | Bếp / Phòng ăn · Phòng ngủ / Phòng khách · Tủ lạnh / Máy giặt |
| 💪 Cơ thể | `body` | 16 | Nách / Háng · Lỗ mũi / Lỗ tai · Lông mày / Lông mi |
| 🎤 Showbiz Việt | `showbiz` | 13 | Sơn Tùng / Mono · Chipu / Khởi My · Đen Vâu / Binz |
| 💬 Thành ngữ & trend | `idioms` | 12 | Bó tay / Chán như con gián · Ăn cháo đá bát / Qua cầu rút ván · Nước đổ lá khoai / Đàn gảy tai trâu |
| 👷 Nghề nghiệp | `jobs` | 16 | Bác sĩ / Y tá · Giáo viên / Gia sư · Công an / Bảo vệ |
| 🐶 Con vật | `animals` | 18 | Chó / Mèo · Gà / Vịt · Hổ / Sư tử |
| 📱 Công nghệ | `tech` | 16 | Máy tính / Điện thoại · iPhone / Samsung · Facebook / Instagram |
| ⚽ Thể thao | `sports` | 15 | Bóng đá / Bóng rổ · Cầu lông / Tennis · Bơi / Lặn |
| 🎒 Trường lớp | `school` | 15 | Toán / Lý · Văn / Sử · Hóa / Sinh |
| 🛵 Xe cộ | `vehicles` | 15 | Xe máy / Xe đạp điện · Xe buýt / Tàu điện · Máy bay / Trực thăng |
| 🥭 Trái cây | `fruits` | 15 | Xoài / Đu đủ · Sầu riêng / Mít · Chôm chôm / Vải |
| 🎬 Phim & hoạt hình | `movies` | 15 | Doraemon / Conan · Naruto / One Piece · Frozen / Moana |
| 🛍️ Thương hiệu | `brands` | 15 | Grab / Be · Shopee / Lazada · Highlands / Phúc Long |
| 🧧 Lễ Tết | `festivals` | 14 | Tết Nguyên Đán / Trung Thu · Lì xì / Quà Tết · Bánh chưng / Bánh tét |
| 👕 Quần áo & phụ kiện | `clothes` | 16 | Áo thun / Áo sơ mi · Quần jean / Quần tây · Chân váy / Quần short |
| 🎮 Trò chơi | `games` | 15 | Cờ vua / Cờ tướng · Liên Quân / PUBG · Free Fire / Liên Minh Huyền Thoại |
| 💘 Hẹn hò | `love` | 13 | Crush / Người yêu cũ · Tỏ tình / Cầu hôn · Hẹn hò / Đi xem mắt |

## Adding a theme

1. Add `words/<id>.json` with `id`, one `emoji`, a Vietnamese `name` and at least 12 `pairs`.
2. Add the import and the id to `PACKS` in `src/game/words.ts` (the order there is the order
   pickers show).
3. `npm test` checks the shape, the minimum size and that no pair repeats across themes.

## Open question

- Who reviews PRs that add inside-joke pairs, so no pair makes someone in the group
  uncomfortable?
