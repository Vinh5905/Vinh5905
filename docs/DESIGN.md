# Thiết kế: "mô hình dữ liệu trên bàn làm việc"

## 1. Vấn đề trong ảnh tham khảo

| # | Vấn đề | Cách sửa |
|---|---|---|
| 1 | Lời chào, tên và đoạn giới thiệu đều là `<h1>/<h3>` đậm, cỡ gần nhau, nên không có điểm neo. | Ba cấp chữ: lời chào 28 Medium màu chữ phụ → tên 58 Bold (điểm neo) → đoạn giới thiệu là văn bản README thường, độ đậm vừa phải. |
| 2 | Nhiều khoảng trắng và đường `---` nhưng không có nhịp đọc. | Một lưới duy nhất: khối rộng 760, khối đôi 2 × 376. Không dùng heading Markdown hay đường kẻ trang trí. Mỗi khối tự có lề trên/dưới. |
| 3 | Lịch contribution là 3D nhưng donut và radar là hình 2D đặt cạnh. | Donut có độ dày (mặt trên, vách ngoài, vách trong, bóng tiếp xúc). Bệ logo và khối nhỏ trong hero dùng cùng phép chiếu iso 30° và cùng hướng sáng. Radar giữ dạng phẳng cho dễ đọc, đặt trên một tấm ngũ giác mỏng. |
| 4 | Donut có mảng "other" xám #444 rất lớn, màu lát rời rạc, đường phân cách cứng, legend thưa. | "その他" dùng xám ánh xanh nhạt. Màu GitHub được giữ hue nhưng đưa về cùng dải sáng/bão hoà, và hue quá gần nhau (Java/Jupyter) được tách ra. Thay đường phân cách màu nền bằng cạnh sáng mỏng. Legend 6 dòng có tên và %, số căn phải. |
| 5 | Biểu đồ, số liệu và chữ không chung một hệ căn chỉnh. | Mọi tiêu đề bắt đầu ở x = 0 của khối, thẳng với chữ README. Số căn phải. Cột thứ hai bắt đầu sau 376 + khoảng cách inline. |
| 6 | Dark/light chỉ là đổi màu nền. | Mỗi theme có token riêng cho mặt trên/trái/phải của khối, bóng (light: bóng trong 12%; dark: đen 42%), cạnh sáng (chỉ có ở dark), mặt bệ và biến thể logo đảo màu (AWS, Helm, Ansible, pandas). |
| 7 | Ô trống là lưới xám nặng. | Ô trống là tấm phẳng gần cùng màu với tấm đế, nên rãnh giữa các ô chỉ còn là đường mảnh. |
| 8 | Chữ trong SVG phụ thuộc font máy người xem (Ubuntu → fallback). | Toàn bộ chữ được chuyển thành path khi build (IBM Plex Sans JP), nên máy nào cũng hiển thị giống nhau. |

## 2. Token

| Token | Light | Dark |
|---|---|---|
| Nền (GitHub) | #FFFFFF | #0D1117 |
| Chữ chính / phụ / chú thích | #17251E / #52665B / #6F8278 | #E6EDF3 / #9DAFA5 / #7E9187 |
| Accent | #059669 | #34D399 |
| Mức contribution 0→4 | #E2EBE5 #BDEDD5 #6FD6A6 #1DAE78 #047857 | #19231F #155A42 #178B60 #25B47D #4FE0A6 |
| Tấm đế (trên/trái/phải) | #F1F6F3 / #E1EBE5 / #D2DFD7 | #141D19 / #101714 / #0B110E |

* Ánh sáng chiếu từ phía trên bên trái. Mặt trên giữ màu gốc, mặt trái tối hơn 7–8% L, mặt phải tối hơn 13–17% L. Bóng đổ về phía dưới bên phải.
* Font: IBM Plex Sans JP, một họ cho cả tiếng Nhật lẫn Latin. Đây là sans có chất kỹ thuật và nét chữ chính xác. Font ở dạng outline nên không phải nhúng font.
* Chuyển động: một nhịp vào khoảng 0.9–1.6 s (cột mọc theo tuần, bệ xuất hiện lần lượt, donut quét một lần, radar nở một lần). Sau đó chỉ còn ba chuyển động nền chậm có cùng chu kỳ 9 s: vệt sáng qua tên, vệt sáng qua mặt donut và gói dữ liệu chạy trên đường nối ở hero. Ngoài ra logo nhấp nhô 3 px theo chu kỳ 6.4 s, lệch pha theo cột.

## 3. Thư viện github-profile-3d-contrib: những gì đã đọc

Phiên bản v0.9.3 (commit `7d95e7d`). Đã đọc `src/index.ts`, `type.ts`, `create-svg.ts`, `create-3d-contrib.ts`, `create-pie-language.ts`, `create-radar-contrib.ts`, `create-css-colors.ts` và `aggregate-user-info.ts`.

* **Cấu hình có thật:** `SETTING_JSON` (một object hoặc mảng) với `type` (`normal` / `season` / `rainbow` / `bitmap` / `pie_lang_only` / `radar_contrib_only`), `contribColors[5]`, `backgroundColor`, `foregroundColor`, `strongColor`, `weakColor`, `radarColor`, `growingAnimation`, `fileName`, `l10n`, `darkMode`.
* **Không có:** font, bevel, donut 3D, stagger, bóng hay màu riêng cho từng mặt khối. Mặt bên luôn là `d3.color.darker(0.5 / 1)`. Font cố định là Ubuntu/Helvetica/Arial. Animation dựng mọi cột cùng lúc trong 3 s bằng SMIL, nên `prefers-reduced-motion` không tắt được.
* **Ý nghĩa dữ liệu donut:** commit contribution trong năm qua, gom theo **ngôn ngữ chính của repository**. Lấy top 5 ngôn ngữ. "other" = tổng commit − tổng top 5, gồm cả commit ở repo không có ngôn ngữ chính. Vì vậy biểu đồ được đặt tên "言語別コミット" và **không** phải mức thành thạo.
* **Radar:** 5 trục Commit / Issue / PullReq / Review / Repo theo thang log (vòng 1, 10, 100, 1K, 10K; level = log10(v) + 1, giá trị 0 → 0.8). Thiết kế mới giữ nguyên thang này.

Vì cấu hình không đủ cho các yêu cầu ở trên, dự án **dùng nguyên mã lấy dữ liệu của thư viện** (`fetchData` và `aggregateUserInfo`, được compile từ commit đã ghim). Phần vẽ do một renderer riêng đảm nhận, với hình học tái tạo theo thư viện: góc 30° và chiều cao `log10(n/20 + 1) × 144 + 3` cho mỗi ô 20 px. Renderer không sửa chuỗi trong SVG của thư viện.

## 4. Danh sách công nghệ: căn cứ

Nguồn đối chiếu gồm các thư mục dự án trong OneDrive/Workspace (quét theo tên file và nội dung cấu hình/mã, không tính file `.md`) và danh sách repo công khai của Vinh5905. Đây là quét bằng mẫu ký tự, không phải kiểm tra từng dòng mã.

| Công nghệ | Căn cứ trong mã/cấu hình (ví dụ) |
|---|---|
| Python, pandas | nhiều dự án (agriculture_data_pipeline, crawl_batdongsan, AIDE…) |
| PostgreSQL | japan_analysis, be_mooccubex, IE103… |
| Apache Airflow | japan_analysis (các thư mục khác chỉ nhắc trong tài liệu) |
| dbt | `dbt_project.yml` trong japan_analysis, noaa-climatology-pipeline, suumo_pipeline, AIDE |
| MinIO | japan_analysis, suumo_pipeline, AIDE |
| Cloudflare R2 | japan_analysis, RPG_2D_Adventure |
| Docker | Dockerfile/compose trong nhiều dự án |
| AWS, Terraform, Ansible, Kubernetes, Helm, Argo CD | blog-infra (terraform/, ansible/playbooks/50-argocd.yml, kubeadm templates); terraform-lab |
| GitHub Actions | `.github/workflows` trong japan_analysis, noaa-climatology-pipeline, ETL_Azure_Databricks… |
| Prometheus, Grafana | blog-infra (Grafana còn có ở noaa-climatology-pipeline) |
| Git, Linux | mọi repo; blog-infra cấu hình node Linux bằng Ansible |

**Có căn cứ trong mã nhưng chưa thêm** để giữ danh sách bạn đã chọn (19 icon): Dagster, Apache Spark, Kafka, Databricks, Azure, ClickHouse, Metabase. Muốn thêm thì xem docs/CUSTOMIZE.md.
