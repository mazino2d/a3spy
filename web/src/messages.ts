// Every string the web app shows (Vietnamese). Same voice as the bot: short, playful, readable in 3 seconds.

export const t = {
  appName: "A3 Spy",
  tagline: "Quản trò Who is Spy cho cả bàn",

  // Name
  namePrompt: "Bạn tên gì?",
  nameHint: "Tên này hiện cho cả bàn thấy.",
  namePlaceholder: "Ví dụ: Minh",
  nameInvalid: "Tên từ 1 đến 24 ký tự nhé.",
  joinRoom: (code: string) => `Vào phòng ${code}`,
  next: "Tiếp tục",

  // Home
  hello: (name: string) => `Chào ${name} 👋`,
  createRoom: "🏠 Mở phòng mới",
  orJoin: "hoặc nhập mã phòng",
  codePlaceholder: "Mã 4 ký tự",
  join: "Vào",
  roomNotFound: "Không tìm thấy phòng này. Kiểm tra lại mã nhé.",
  changeName: "Đổi tên",
  iosInstall: "Thêm vào màn hình chính: bấm Chia sẻ → Thêm vào MH chính.",
  dismiss: "Ẩn",

  // Already in another room
  inOtherRoom: (code: string) => `Bạn đang ở phòng ${code}.`,
  backToRoom: (code: string) => `Quay lại phòng ${code}`,
  leaveAndJoin: (code: string) => `Rời phòng đó và vào ${code}`,

  // Lobby
  room: (code: string) => `Phòng ${code}`,
  scanToJoin: "Quét mã để vào phòng",
  share: "📤 Chia sẻ link",
  copied: "Đã chép link!",
  shareTitle: "Vào chơi A3 Spy",
  shareText: (code: string) => `Vào phòng ${code} chơi Who is Spy nè!`,
  players: (n: number) => `Người chơi (${n})`,
  waiting: (n: number) => `Chờ ván sau (${n})`,
  you: "bạn",
  start: "▶️ Bắt đầu",
  needMore: "Cần ít nhất 3 người để bắt đầu.",
  readyToStart: "Đủ người rồi, bấm Bắt đầu khi cả bàn sẵn sàng.",
  waitHost: "Chờ host bắt đầu nhé.",
  leave: "🚪 Rời phòng",
  telegramToo: "Bạn nào dùng Telegram thì vào bằng link này:",

  // Game placeholder (screens come in the next phase)
  gameRunning: "Ván đang chạy…",

  // Connection
  connecting: "Đang kết nối…",
  offline: "Mất kết nối, đang nối lại…",
  replaced: "Phòng này đang mở ở tab hoặc máy khác.",
  useHere: "Dùng ở đây",
  roomClosed: "Phòng đã đóng.",
  backHome: "Về trang chủ",

  // Errors from the room
  errors: {
    not_host: "Chỉ host mới làm được việc này.",
    too_few_players: "Cần ít nhất 3 người để bắt đầu.",
    game_running: "Ván đang chạy rồi.",
    stale: "Màn hình cũ rồi, đã cập nhật lại.",
    not_alive: "Bạn đã bị loại, không vote được nữa.",
    invalid_target: "Không vote cho người này được.",
    generic: "Có lỗi, thử lại nhé.",
  } as Record<string, string>,
  network: "Không kết nối được. Kiểm tra mạng rồi thử lại.",
} as const;
