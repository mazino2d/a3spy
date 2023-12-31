import os
from a3spy_bot import A3SpyBot

if __name__ == "__main__":
    os.environ["BOT_TOKEN"] = "6495642119:AAE5x-nTZUC3lMavoErkBWgPsv0I_CPWvUo"
    BOT_TOKEN = os.environ.get('BOT_TOKEN')
    bot = A3SpyBot(BOT_TOKEN)
    handler = bot.handler

    handler.register_message_handler(callback=bot.start, commands=["start", "help", "h"])
    handler.register_message_handler(callback=bot.join, commands=["join", "j"])
    handler.register_message_handler(callback=bot.play, commands=["play", "p"])
    handler.register_message_handler(callback=bot.config, commands=["config", "c"])
    handler.register_message_handler(callback=bot.rooms, commands=["rooms", "r"])
    handler.register_message_handler(callback=bot.keywords, commands=["keywords", "k"])
    handler.register_message_handler(callback=bot.reset, commands=["reset"])
    handler.register_message_handler(callback=bot.whoisspy, commands=["whoisspy"])

    handler.infinity_polling()
