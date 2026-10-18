// Every string the bot sends (Vietnamese). The game runs in the web app (M7); the bot is a
// signpost and an announcement channel, so nothing here ever carries a word or a role.

export const msg = {
  signpost: [
    "🕵️ <b>A3 Spy</b> — quản trò Who is Spy cho hội bạn.",
    "Mỗi người một điện thoại, cả nhóm nói chuyện bằng miệng hoặc voice call; A3 Spy lo chia từ, gọi lượt, đếm phiếu.",
    "",
    "<b>Luật nhanh</b>",
    "• Dân chung một từ, spy có từ gần giống, Mr. White không có từ.",
    "• Mỗi vòng, mỗi người tả từ của mình một câu.",
    "• Cả bàn vote loại người khả nghi.",
    "• Dân thắng khi loại hết spy và Mr. White.",
    "",
    "Giờ A3 Spy chơi trên web 👇",
  ].join("\n"),
  btnPlay: "🎮 Chơi trên web",
  roomMoved: (code: string) => `Phòng <b>${code}</b> giờ ở trên web 👇`,
  btnRoom: (code: string) => `🚪 Vào phòng ${code}`,
  /** Answer to a tap on a button from an old game message. */
  moved: "A3 Spy đã chuyển sang web, mở /start để lấy link nhé.",

  // Announcements (owner only; plain text, no HTML)
  announceUsage: "Gõ /announce kèm nội dung, ví dụ: /announce A3 Spy có bộ từ mới!",
  announceTooLong: (max: number) => `Thông báo dài quá, tối đa ${max} ký tự.`,
  announcePreview: (count: number, text: string) => `📣 Xem trước — sẽ gửi tới ${count} người:\n\n${text}`,
  btnAnnounceSend: "📤 Gửi",
  btnAnnounceCancel: "✖️ Huỷ",
  announceSending: "Đang gửi…",
  announceCancelled: "Đã huỷ.",
  announceStale: "Bản xem trước này cũ rồi, không gửi.",
  announceBusy: "Đang gửi một thông báo khác, đợi xong đã.",
  resetConfirm: (count: number) => `🧹 Xoá thống kê của ${count} người? Bảng xếp hạng sẽ về 0, không lấy lại được.`,
  resetEmpty: "Bảng xếp hạng đang trống rồi.",
  btnResetConfirm: "🧹 Xoá hết",
  resetDone: (count: number) => `Đã xoá thống kê của ${count} người.`,
  announceDone: (sent: number, failed: number) => `📣 Đã gửi tới ${sent} người, lỗi ${failed}.`,
};
