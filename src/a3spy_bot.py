from random import choice
from telebot import TeleBot
from telebot.formatting import hbold
from telebot.types import Message, User, ReplyKeyboardMarkup

class A3SpyBot:
    def __init__(self, token: str) -> None:
        self.token = token
        self.handler = TeleBot(token)
        self.init()
    
    def init(self):
        self._rooms = {"A3 SPA": {}, "Lính ngự lâm": {}}
        self._keywords = [
            "An", "Tiểu Tam", "Hải", "Tiền", "Đức", "Nam", "Vinh", "Thịnh", "Adidadong", "Hùng", "Tín", "Khôi", "Nhi", "Thanh", "Trà",
            "Nhà vệ sinh", "Phòng ngủ", "Phòng khách", "Chung cư", "Bếp", "Khách sạn", "Nhà Hàng",
            "8M", "Kyoto", "Sadboiz", "Dân chơi", "Vinh chỉ yêu Mai", "Vinh thương thêm Trang",
            "Trường Long Khánh", "Bác sĩ", "Con chuột", "Cà rốt", "Khoai lang", "Nước tiểu", "Nước cam",
            "Tim", "Gan", "Háng", "Mông", "Nách", "Lổ mũi", "Lổ tai", "Con mắt", "Lông mày", "Môi", "Xanh", "Đỏ", 
            "Cần cù bù siêng năng", "Bó tay", "Chán như con gián", "Mono", "Sơn Tùng", "Chipu", "Khỏi my", "Cứt",
            "Gió", "Biển", "Máy tính", "Con chó"
        ] 
    
    def start(self, message: Message):
        user: User = message.from_user
        self.handler.send_message(user.id, "Cùng chơi A3 SPY bạn nhé!\nChỉ có gián điệp không biết mật mã, cùng nhau thảo luận để tìm ra gián điệp bạn nhé. Nhớ là đừng hớ hên làm lộ từ khóa cho gián điệp đó nha!")

    def join(self, message: Message):
        user: User = message.from_user
        def _join(message: Message):
            room_name = message.text.strip()
            if room_name not in self._rooms:
                self._rooms[room_name] = dict()

            if user.last_name is None and user.last_name is None:
                self._rooms[room_name][user.id] = f"{user.id} No Name"
            else:
                if user.last_name is None:
                    self._rooms[room_name][user.id] = f"{user.first_name}"
                if user.first_name is None:
                    self._rooms[room_name][user.id] = f"{user.last_name}"
            
            self._rooms[room_name][user.id] = f"{user.first_name} {user.last_name}"
            self.handler.send_message(user.id, f"Vào nhóm {hbold(room_name)} thành công!\n", parse_mode='HTML')
            msg = "\n".join([f"{v}" for v in self._rooms[room_name].values()])
            if len(msg) == 0:
                msg = "Chưa có ai tham gia"
            self.handler.send_message(user.id, f"Phòng game {hbold(room_name)}:\n{msg}", parse_mode='HTML')
        try:
            markup = ReplyKeyboardMarkup(one_time_keyboard=True)
            for room_name in self._rooms.keys():
                markup.add(room_name)
            message = self.handler.send_message(user.id, f"Bạn muốn tham gia nhóm nào:", reply_markup=markup)
            self.handler.register_next_step_handler(message, _join)
        except:
            self.handler.send_message(user.id, f"Hệ thống có lỗi xảy ra!")

    def rooms(self, message: Message):
        user: User = message.from_user
        try:
            if len(self._rooms) == 0:
                self.handler.send_message(user.id, f"Chưa có phòng game được tạo!")
            for room_name, users in self._rooms.items():
                msg = "\n".join([f"{v}" for v in users.values()])
                if len(msg) == 0:
                    msg = "Chưa có ai tham gia"
                self.handler.send_message(user.id, f"Phòng game {room_name}:\n{msg}")
        except:
            self.handler.send_message(user.id, f"Hệ thống có lỗi xảy ra!")

    def play(self, message: Message):
        user: User = message.from_user
        def _play(message: Message):
            room_name = message.text.strip()
            if room_name not in self._rooms.keys():
                self.handler.reply_to(message, f"Bắt đầu chơi thất bại.")
            else:
                ids = list(self._rooms[room_name].keys())
                if len(ids) == 0:
                    self.handler.send_message(user.id, "Phòng chơi chưa có ai tham gia!")
                    return
                spy_id = choice(ids)
                keyword = choice(self._keywords)
                for a3id in ids:
                    if len(ids) == 1:
                        self.handler.send_message(a3id, "Cảnh báo: Phòng chơi chỉ có một người!\n")
                    if len(ids) == 2:
                        self.handler.send_message(a3id, "Cảnh báo: Phòng chơi chỉ có hai người!\n")
                    self.handler.send_message(a3id, "Bắt đầu chơi, đừng cho mọi người thấy tin nhắn của bạn nhé!")
                    if a3id == spy_id:
                        self.handler.send_message(a3id, "Bạn là điệp viên!")
                    else:
                        self.handler.send_message(a3id, "Mật mã của chúng ta là: " + keyword)
        try:
            if len(self._rooms) == 0:
                self.handler.send_message(user.id, f"Chưa có phòng chơi được tạo!")
            else:
                markup = ReplyKeyboardMarkup(one_time_keyboard=True)
                for room_name in self._rooms.keys():
                    markup.add(room_name)
                message = self.handler.send_message(user.id, f"Chọn nhóm để bắt đầu chơi:", reply_markup=markup)
                self.handler.register_next_step_handler(message, _play)
        except:
            self.handler.send_message(user.id, f"Hệ thống có lỗi xảy ra!")

    def config(self, message: Message):
        user: User = message.from_user
        def _config(message: Message):
            self._keywords = [e.strip() for e in message.text.split(",")]
            self.handler.send_message(user.id, "Cấu hình danh sách từ khóa thành công!\n" + ", ".join(self._keywords))   
        try:
            self.handler.send_message(user.id, f"Nhập từ khóa (cách bởi dấu phẩy):")
            self.handler.register_next_step_handler(message, _config)
        except:
            self.handler.send_message(user.id, f"Hệ thống có lỗi xảy ra!")   

    def keywords(self, message: Message):
        user: User = message.from_user
        try:
            self.handler.send_message(user.id, ", ".join(self._keywords))   
        except:
            self.handler.send_message(user.id, f"Hệ thống có lỗi xảy ra!")

    def reset(self, message: Message):
        user: User = message.from_user
        try:
            self.init()
        except:
            self.handler.send_message(user.id, f"Hệ thống có lỗi xảy ra!")

    def whoisspy(self, message: Message):
        user: User = message.from_user
        try:
            self.handler.send_photo(user.id, "https://kenh14cdn.com/2018/3/17/cuoimim-15212745932561426229785.jpg")
            self.handler.send_message(user.id, "Lòng trung thực là chương đầu tiên của cuốn sách trí tuệ - <b>Thomas Jefferson</b>", parse_mode="HTML")
        except:
            self.handler.send_message(user.id, f"Hệ thống có lỗi xảy ra!")

            