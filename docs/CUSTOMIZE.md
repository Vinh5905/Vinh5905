# Cách sửa và sinh lại asset

```
README.md                    ← SINH TỰ ĐỘNG bởi `npm run build` (đừng sửa tay)
profile.config.json          ← username, lời chào/tên/đoạn giới thiệu, tiêu đề mục, nhóm icon, số năm, nhãn
config/theme.json            ← màu, ánh sáng, bóng, thông số chuyển động (light/dark)
config/icons.json            ← nguồn từng logo và màu đảo cho theme tối
config/sources.json          ← phiên bản Devicon / Simple Icons / font / emoji đã ghim
assets/icons/                ← logo đã tải về và metrics.json (kích thước quang học)
assets/generated/            ← ảnh SVG sinh ra (không sửa tay)
data/github-stats.json       ← số liệu 12 tháng gần nhất (workflow ghi đè)
data/years/<năm>.json        ← lịch contribution từng năm kể từ khi tạo tài khoản (dùng cho tổng tích luỹ, chuỗi ngày và các mục 今年/昨年/一昨年)
scripts/                     ← build.mjs, fetch-data.mjs, render/*, lib/*
.github/workflows/update-profile.yml
```

## Chạy lại

```bash
npm ci
npm run build            # vẽ lại toàn bộ SVG từ data/github-stats.json (lần đầu sẽ tải font)
npm run preview          # tạo .cache/preview/index.html, khung giống GitHub
npm run verify           # kiểm tra + chụp desktop/mobile × light/dark × động/tĩnh vào .cache/preview/shots/ (cần Playwright)
```

Lấy dữ liệu:

* **Trên GitHub Actions** (dữ liệu chính thức): chạy workflow *Update profile assets* bằng *Run workflow*, hoặc chờ lịch chạy hằng ngày lúc 03:17 giờ Việt Nam.
* **Trên máy, có token:**
  ```bash
  git clone https://github.com/yoshi389111/github-profile-3d-contrib .cache/3d-contrib
  git -C .cache/3d-contrib checkout 7d95e7d4cdc028dd1e1cbd957d65f35efb12ae39
  (cd .cache/3d-contrib && npm ci && npx tsc)
  GITHUB_TOKEN=xxx node scripts/fetch-data.mjs
  ```
* **Trên máy, không có token** (chỉ để xem trước): `npm run fetch:public`. Lịch contribution lấy từ trang công khai. Số commit/issue/PR lấy từ Search API công khai, nên chỉ là ước lượng. Lần chạy workflow tiếp theo sẽ thay bằng dữ liệu GraphQL.

## Sửa phần giới thiệu

Tất cả nằm trong `intro` của `profile.config.json`:
* `greeting`, `namePrefix`, `name`, `nameSuffix`: lời chào và tên.
* `lines`: các dòng giới thiệu trên desktop; `linesCompact`: các dòng trên điện thoại (ngắn hơn). `{wave}` = 👋, `{smile}` = 😊.
* `alt`: toàn văn bản dạng chữ, được ghi vào thuộc tính alt của ảnh (đọc được bằng trình đọc màn hình, hiện ra khi ảnh không tải).

Chạy `npm run build`: ảnh và `README.md` được sinh lại. Font IBM Plex Sans JP có đủ kana và kanji thông dụng; nếu thiếu glyph, build dừng và báo lỗi chứ không vẽ ô trống.

Tiêu đề hai mục phân tách nằm ở `sections`. Phần tổng hợp (総コントリビューション / 現在の連続日数 / 最長連続日数) tính theo cùng quy tắc với github-readme-streak-stats: hôm nay chưa có contribution thì chuỗi hiện tại chưa bị ngắt; vòng tròn emerald thể hiện tỉ lệ chuỗi hiện tại ÷ chuỗi dài nhất. Nhãn của phần này nằm trong `labels`. Số năm có nút xem riêng nằm ở `github.years` (mặc định 3).

## Sửa danh sách công nghệ

1. Nếu là logo mới, thêm một mục vào `config/icons.json`:
   ```json
   "spark": { "label": "Apache Spark", "source": "simple-icons", "path": "apachespark.svg", "color": "#E25A1C" }
   ```
   (`apachespark.svg` và màu `#E25A1C` có thật trong Simple Icons 16.38.0.) Trước khi thêm logo khác, hãy kiểm tra file có tồn tại trong bộ icon (Devicon: `devicon.json`; Simple Icons: thư mục `icons/` và `data/simple-icons.json`). Ví dụ: Devicon 2.18.0 và Simple Icons 16.38.0 đều không có logo Dagster.
2. Chạy `npm run vendor` để tải logo và đo kích thước quang học (cần Playwright).
3. Thêm id vào `rows` của nhóm tương ứng trong `profile.config.json`. Mỗi nhóm có tối đa 3 hàng × 4 logo.
4. Nếu logo có màu tối khó thấy trên nền tối, thêm `"dark": { "#màu-gốc": "#FFFFFF" }` (dùng biến thể đảo màu của chính thương hiệu).
5. Chạy `npm run build` (alt text trong README tự cập nhật).

## Đổi màu

Mọi màu nằm trong `config/theme.json`, mỗi theme một khối:

* `levels`: 5 màu mặt trên của ô contribution, từ "không có" đến "nhiều nhất".
* `shade.left` / `shade.right`: độ tối của mặt bên (giá trị âm, tính bằng lightness HSL). `rimOpacity` là cạnh sáng.
* `shadow`, `pedestal`, `plate`: bóng, bệ logo và tấm đế.
* `langLightness`: dải độ sáng áp cho màu ngôn ngữ trong donut.

Sau khi sửa, chạy `npm run build && npm run preview && npm run verify` rồi xem ảnh trong `.cache/preview/shots/`.

## Đưa lên profile

GitHub chỉ hiển thị README của repo **`Vinh5905/Vinh5905`** trên trang profile. Thư mục này đang trỏ tới `Vinh5905.github.io`. Có hai cách:

```bash
# A. Đưa đúng bộ file này vào repo profile (khuyến nghị)
git remote add profile https://github.com/Vinh5905/Vinh5905.git
git push profile HEAD:main --force   # thay README cũ của repo Vinh5905 (đã sao lưu ở docs/legacy-README.md)

# B. Giữ ở Vinh5905.github.io (README chỉ hiện trong repo, không hiện trên profile)
git push origin main
```

Sau lần push đầu, vào tab **Actions** của repo đó và chạy *Update profile assets* một lần để thay dữ liệu xem trước bằng dữ liệu GraphQL.

## Tia sét trong hero

Cấu hình ở `lightning` trong `profile.config.json`:

| Khoá | Ý nghĩa |
|---|---|
| `enabled` | bật/tắt |
| `seed` | đổi số này để có một bộ tia sét khác (cùng seed thì luôn ra cùng kết quả) |
| `loopSeconds` | độ dài một vòng lặp; trong một vòng không tia nào lặp lại |
| `gapSeconds` | khoảng nghỉ ngẫu nhiên giữa hai lần phóng điện (mặc định 0.6–2.2 s) |
| `doubleChance` | xác suất có hai tia liền nhau |
| `mix` | tỉ lệ tia yếu / vừa / mạnh (mặc định 65% / 25% / 10%) |

Mỗi tia: một đốm sáng ở điểm đầu → tia mọc nhanh dọc đường gấp khúc tới điểm cuối → giữ nguyên và chớp nháy không đều → tắt tại chỗ: từng đoạn của tia tắt ở những thời điểm ngẫu nhiên khác nhau (không quét theo một chiều), quầng sáng còn lưu lại một chút rồi mới tắt. Nhánh phụ phóng ra khi tia đi qua gốc nhánh và tắt trước thân chính.
| `size`, `thickness` | hệ số độ dài và độ dày của tia |
| `speed` | tốc độ chạy (nhỏ hơn 1 = chạy lâu hơn) |
| `orientation`, `maxTilt` | `horizontal`: tia chạy ngang hoặc cong ngang, không nghiêng quá `maxTilt` radian (0.6 ≈ 34°); `any`: mọi hướng |
| `glow` | độ sáng quầng xanh |
| `avoidText` | `false` (mặc định): tia sét có thể chạy khắp ảnh hero, kể cả đè lên chữ; `true`: né chữ và cụm cột |
| `margin`, `textClearance` | khoảng cách tối thiểu tới mép ảnh và tới chữ |
| `colors.dark`, `colors.light` | màu lõi (`core`), thân (`main`), quầng (`glow`), nhánh (`secondary`) cho từng theme |

Vùng phóng điện là toàn bộ ảnh hero (cách mép `margin` px). Khi `avoidText` là `true`, hệ thống tự đo vị trí chữ để tia né đúng chỗ.
Bản tĩnh và chế độ giảm chuyển động không có tia sét.

Xem trước dạng video: `node scripts/record.mjs assets/generated/hero-dark.svg out.mp4 --to 20` (cần Playwright và ffmpeg).
