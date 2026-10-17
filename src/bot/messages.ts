// Every user-facing string lives here (Vietnamese). Callers pass names and
// words already HTML-escaped (see esc in render.ts).

import type { Role } from "../game/roles";

const roleName: Record<Role, string> = { civilian: "Dân", spy: "Spy", white: "Mr. White" };

export const msg = {
  welcome: [
    "Chào mừng tới <b>A3 Spy</b>! 🕵️",
    "",
    "Mình là quản trò cho Who is Spy khi cả nhóm ngồi chơi chung.",
    "Mọi người mô tả và cãi nhau bằng miệng, mình lo chia từ, gọi lượt, đếm phiếu.",
    "",
    "Gõ /newgame để mở phòng, hoặc bấm link mời bạn bè gửi.",
  ].join("\n"),
  help: [
    "<b>Lệnh</b>",
    "/newgame — mở phòng mới",
    "/join &lt;mã&gt; — vào phòng",
    "/leave — rời phòng",
    "/score — bảng điểm của phòng",
    "/stats — thống kê dài hạn và bảng xếp hạng cả nhóm",
    "/end — (host) kết thúc ván đang chơi",
    "/help — xem hướng dẫn",
  ].join("\n"),
  unknownText: "Mình chỉ hiểu lệnh thôi nha. Gõ /help để xem danh sách lệnh.",

  // Rooms
  alreadyInRoom: (code: string) => `Bạn đang ở phòng <b>${code}</b>. Gõ /leave để rời trước đã.`,
  alreadyInThisRoom: (code: string) => `Bạn đã ở trong phòng <b>${code}</b> rồi.`,
  notInRoom: "Bạn chưa ở phòng nào. Gõ /newgame để mở phòng hoặc /join &lt;mã&gt; để vào.",
  joinUsage: "Gõ /join kèm mã phòng, ví dụ: <code>/join AB12</code>",
  roomNotFound: (code: string) => `Không tìm thấy phòng <b>${code}</b>. Kiểm tra lại mã nhé.`,
  lobby: (
    code: string,
    host: string,
    players: string[],
    link: string,
    web: string | null,
    settings: string[],
    isHost: boolean,
  ) =>
    [
      `🏠 <b>Phòng ${code}</b> · host: ${host}`,
      "",
      `<b>Người chơi (${players.length})</b>`,
      ...players.map((p, i) => `${i + 1}. ${p}`),
      "",
      ...settings,
      "",
      `Mời bạn bè: ${link}`,
      ...(web ? [`Không dùng Telegram? Mở web: ${web}`] : []),
      isHost
        ? players.length < 3
          ? "Cần ít nhất 3 người để bắt đầu."
          : "Đủ người rồi, bấm <b>Bắt đầu</b> khi cả bàn sẵn sàng."
        : "Chờ host bắt đầu nhé.",
    ].join("\n"),
  youLeft: (code: string) => `Bạn đã rời phòng <b>${code}</b>.`,
  queued: "Ván đang chạy, bạn sẽ được chia bài ở ván sau.",
  queuedNotice: (name: string) => `${name} sẽ vào chơi từ ván sau.`,
  leftNotice: (name: string) => `🚪 ${name} đã rời phòng.`,
  hostChanged: (name: string) => `👑 ${name} giờ là host.`,
  roomIdleClosed: (code: string) => `Phòng <b>${code}</b> đã đóng vì không hoạt động 6 tiếng.`,

  // Host settings
  settingsCounts: (spies: number, white: number, auto: boolean) =>
    `⚙️ ${spies} spy · Mr. White: ${white ? "có" : "không"}${auto ? " <i>(tự động theo số người)</i>" : ""}`,
  settingsAutoPending: "⚙️ Số spy và Mr. White tự động theo số người.",
  settingsThemes: (summary: string) => `📚 Chủ đề: ${summary}`,
  allThemes: (n: number) => `tất cả ${n}`,
  someThemes: (on: number, n: number, emojis: string) => `${on}/${n} ${emojis}`,
  themesPanel: (on: number, n: number) =>
    [`📚 <b>Chọn chủ đề</b> · đang bật ${on}/${n}`, "Bấm để bật/tắt. Mỗi ván rút một cặp từ các chủ đề đang bật."].join(
      "\n",
    ),
  themesClosed: (summary: string) => `📚 Chủ đề: ${summary}`,
  settingsTimers: (discussion: number, vote: number) =>
    `⏱ Thảo luận: ${discussion ? `${discussion} phút` : "tắt"} · Vote: ${vote ? `${vote} phút` : "tắt"}`,
  settingsVoice: "🎙 Chơi online: phòng có voice call cho người ở xa.",
  discussionTimer: (minutes: number) => `⏱ Có ${minutes} phút thảo luận.`,
  voteTimer: (minutes: number) => `⏱ Có ${minutes} phút để vote.`,
  discussionUp: "⏰ <b>Hết giờ thảo luận!</b> Host mở vote khi cả bàn sẵn sàng nhé.",
  voteUp: "⏰ <b>Hết giờ vote!</b> Ai chưa vote thì nhanh tay, host chốt vote nhé.",
  settingsWarning: "⚠️ Dân phải đông hơn spy + Mr. White — giảm spy hoặc tắt Mr. White.",

  // Buttons
  btnStart: "▶️ Bắt đầu",
  btnLeave: "🚪 Rời phòng",
  btnOpenVote: "🗳 Mở vote",
  btnCloseVote: "✅ Chốt vote",
  btnEnd: "⏹ Kết thúc ván",
  btnAgain: "🔁 Chơi lại",
  btnWord: "👀 Xem từ của tôi",
  btnSpyLess: "➖ Spy",
  btnSpyMore: "➕ Spy",
  btnWhite: (on: boolean) => `${on ? "✅" : "⬜"} Mr. White`,
  btnAuto: "🔄 Tự động",
  btnThemes: (on: number, n: number) => `📚 Chủ đề (${on}/${n})`,
  btnAllThemes: "✅ Bật tất cả",
  btnThemesDone: "👌 Xong",
  btnVoiceJoin: "🎙 Vào voice",
  btnVoice: (on: boolean) => `${on ? "✅" : "⬜"} 🎙 Chơi online`,
  btnTimer: (kind: "discussion" | "vote", minutes: number) =>
    `⏱ ${kind === "discussion" ? "Thảo luận" : "Vote"}: ${minutes ? `${minutes} phút` : "tắt"}`,

  // Callback answers
  notHost: "Chỉ host mới bấm được nút này.",
  tooFewPlayers: "Cần ít nhất 3 người để bắt đầu.",
  stale: "Nút này của vòng trước rồi.",
  gameRunning: "Ván đang chạy rồi.",
  notAlive: "Bạn đã bị loại, không vote được nữa.",
  invalidTarget: "Không vote cho người này được.",
  voted: (name: string) => `Đã vote ${name}. Đổi ý thì bấm người khác.`,
  notPlaying: "Bạn không chơi ván này.",
  badCounts: "Dân phải đông hơn spy + Mr. White. Giảm spy hoặc tắt Mr. White nhé.",
  badSetting: "Phải chọn ít nhất một chủ đề.",
  yourWordAlert: (word: string | null) => (word === null ? "Bạn là Mr. White — không có từ." : `Từ của bạn: ${word}`),

  // Game
  gameStarted: (id: number, players: number, spies: number, white: number) =>
    `🎬 <b>Ván #${id}</b> bắt đầu với ${players} người: ${spies} spy${white ? `, ${white} Mr. White` : ""}.`,
  yourWord: (word: string) =>
    [
      `🤫 Từ của bạn: <b>${word}</b>`,
      "",
      "Đừng cho ai xem màn hình nhé. Mô tả sao cho phe mình nhận ra mà spy không đoán được.",
    ].join("\n"),
  youAreWhite: [
    "🤫 Bạn là <b>Mr. White</b> — bạn không có từ.",
    "",
    "Nghe mọi người mô tả rồi chém cho khéo. Bị loại thì vẫn còn một lần đoán từ.",
  ].join("\n"),
  round: (round: number, order: string[]) =>
    [`🗣 <b>Vòng ${round}</b> — lần lượt mô tả:`, ...order.map((p, i) => `${i + 1}. ${p}`)].join("\n"),
  hostRoundHint: "Host bấm <b>Mở vote</b> khi cả bàn nói xong.",
  votePrompt: (round: number, revote: boolean) =>
    revote
      ? `🗳 <b>Vote lại (vòng ${round})</b> — chọn một trong những người hoà:`
      : `🗳 <b>Vote vòng ${round}</b> — bạn nghi ai?`,
  voteChosen: (name: string) => `Bạn đang vote: <b>${name}</b>`,
  voteStatus: (count: number, total: number) => `🗳 Đã vote <b>${count}/${total}</b>. Bot tự chốt khi đủ phiếu.`,
  tally: (lines: string[]) => ["📊 <b>Kết quả vote</b>", ...lines].join("\n"),
  tallyLine: (name: string, votes: number) => `• ${name}: ${votes} phiếu`,
  noVotes: "Không ai vote.",
  tie: (names: string[]) => `🤝 Hoà giữa ${names.join(", ")}! Vote lại giữa những người này.`,
  noEliminationTie: "Lại hoà — không ai bị loại vòng này.",
  noEliminationNoVotes: "Không ai bị loại vòng này.",
  eliminated: (name: string, role: Role) => `❌ ${name} bị loại — là <b>${roleName[role]}</b>.`,
  whiteGuessing: (name: string) => `⏳ Chờ ${name} (Mr. White) đoán từ của dân…`,
  whitePrompt: "Bạn bị loại, nhưng còn một cơ hội: <b>gõ từ của dân</b> vào đây. Đoán đúng là bạn thắng!",
  whiteGuessed: (name: string, guess: string, correct: boolean) =>
    correct ? `🎯 ${name} đoán "<b>${guess}</b>" — CHUẨN!` : `🙅 ${name} đoán "<b>${guess}</b>" — sai rồi.`,

  // End
  winner: {
    civilians: "🏆 <b>Dân thắng!</b>",
    spies: "🏆 <b>Phe Spy thắng!</b>",
    white: "🏆 <b>Mr. White thắng một mình!</b>",
  },
  endedEarly: "⏹ Ván đã kết thúc sớm, không tính điểm.",
  reveal: (civilianWord: string, spyWord: string, lines: string[]) =>
    ["🃏 <b>Lật bài</b>", `Từ của dân: <b>${civilianWord}</b>`, `Từ của spy: <b>${spyWord}</b>`, "", ...lines].join(
      "\n",
    ),
  revealLine: (name: string, role: Role, alive: boolean) => `${alive ? "•" : "✝"} ${name}: ${roleName[role]}`,
  hostAgainHint: "Host bấm <b>Chơi lại</b> để chia ván mới với cùng người chơi.",

  // Long-term stats
  statsMine: "📈 <b>Thống kê của bạn</b>",
  statsNone: "Bạn chưa chơi xong ván nào.",
  statsTotal: (games: number, wins: number, rate: number) => `${games} ván · thắng ${wins} (${rate}%)`,
  statsSpy: (games: number, wins: number) => `🕵️ Spy: thắng ${wins}/${games}`,
  statsWhite: (games: number, wins: number, correct: number) =>
    `🎩 Mr. White: thắng ${wins}/${games} · đoán đúng ${correct}`,
  statsBoard: "🏆 <b>Bảng xếp hạng cả nhóm</b>",
  statsBoardEmpty: "Chưa có ván nào kết thúc.",
  statsBoardLine: (rank: number, name: string, wins: number, games: number, rate: number) =>
    `${rank}. ${name} — ${wins} thắng / ${games} ván (${rate}%)`,

  // Score
  score: (lines: string[]) =>
    lines.length ? ["🏅 <b>Bảng điểm (ván thắng)</b>", ...lines].join("\n") : "Chưa có ván nào kết thúc.",
  scoreLine: (rank: number, name: string, wins: number) => `${rank}. ${name}: ${wins}`,
} as const;
