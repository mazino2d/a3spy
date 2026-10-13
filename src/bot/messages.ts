// Every user-facing string lives here (Vietnamese).

export const msg = {
  welcome: [
    "Chào mừng tới <b>A3 Spy</b>! 🕵️",
    "",
    "Mình là quản trò cho Who is Spy khi cả nhóm ngồi chơi chung.",
    "Mọi người mô tả và cãi nhau bằng miệng, mình lo chia từ, gọi lượt, đếm phiếu.",
  ].join("\n"),
  help: [
    "<b>Lệnh</b>",
    "/newgame — mở phòng mới",
    "/join &lt;mã&gt; — vào phòng",
    "/help — xem hướng dẫn",
  ].join("\n"),
  comingSoon: "Tính năng này sắp có, chờ chút nha!",
} as const;
