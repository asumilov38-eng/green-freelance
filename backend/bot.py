# ==========================================
# БОТ ДЛЯ ПРИЕМА ПЛАТЕЖЕЙ
# ==========================================

import logging
from aiogram import Bot, Dispatcher, types
from aiogram.utils import executor

# Токен бота из @BotFather
BOT_TOKEN = "ВАШ_ТОКЕН_БОТА"

# Настройка
logging.basicConfig(level=logging.INFO)
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher(bot)

# ЮKassa (работает в РФ)
YOOKASSA_SHOP_ID = "ВАШ_SHOP_ID"
YOOKASSA_SECRET_KEY = "ВАШ_СЕКРЕТНЫЙ_КЛЮЧ"

@dp.message_handler(commands=['start'])
async def cmd_start(message: types.Message):
    """Обработка команды /start"""
    await message.answer(
        "Добро пожаловать в GreenFreelance!\n\n"
        "Нажмите кнопку 'БИРЖА ФРИЛАНСА' в меню, чтобы открыть приложение.",
        parse_mode="HTML"
    )

@dp.message_handler(content_types=['web_app_data'])
async def handle_webapp_data(message: types.Message):
    """Обработка данных из Mini App"""
    import json
    data = json.loads(message.web_app_data.data)
    
    action = data.get('action')
    
    if action == 'register':
        await message.answer(
            f"Новый пользователь: {data.get('username')}\n"
            f"Телефон: {data.get('phone')}\n"
            f"Роль: {data.get('role')}"
        )
    
    elif action == 'create_payment':
        amount = data.get('amount')
        promo_type = data.get('type')
        
        # Создание счета через ЮKassa
        await bot.send_invoice(
            chat_id=message.chat.id,
            title="Продвижение задания",
            description=f"{'ТОП на 24 часа' if promo_type == 'top24h' else 'Рекламный баннер на 24 часа'}",
            payload=f"promo_{promo_type}",
            provider_token="",  # Для ЮKassa оставьте пустым
            currency="RUB",
            prices=[types.LabeledPrice(label="Продвижение", amount=amount * 100)],
            need_email=True
        )
        await message.answer("Счет отправлен в чат с ботом!")

@dp.pre_checkout_query_handler()
async def process_pre_checkout(pre_checkout_query: types.PreCheckoutQuery):
    """Подтверждение платежа"""
    await bot.answer_pre_checkout_query(pre_checkout_query.id, ok=True)

@dp.message_handler(content_types=['successful_payment'])
async def process_successful_payment(message: types.Message):
    """Успешный платеж"""
    await message.answer(
        "Оплата прошла успешно! Ваше задание продвинуто на 24 часа."
    )

if __name__ == "__main__":
    executor.start_polling(dp, skip_updates=True)