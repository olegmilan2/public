Как сделать Telegram-уведомления без Firebase Blaze

Firebase Cloud Functions сейчас требуют Blaze, поэтому для скрытого bot token используем Cloudflare Worker (бесплатно).

1) Установка Wrangler
- `npm i -g wrangler`
- `wrangler login`

2) Деплой воркера
- `cd /Users/oleg/WebstormProjects/public/worker`
- `wrangler deploy`

3) Задать секреты (1 раз)
- `wrangler secret put TELEGRAM_BOT_TOKEN` (вставь token бота)
- `wrangler secret put TELEGRAM_CHAT_IDS` (вставь chat_id через запятую: `88590436,12345678`)
  Если нужно только в один чат, можно использовать `wrangler secret put TELEGRAM_CHAT_ID`
- (опционально) `wrangler secret put STOPLIST_API_KEY` (если хочешь защиту ключом)

4) Получить URL воркера
Wrangler после deploy покажет URL вида `https://stoplist-telegram-proxy.<user>.workers.dev`.
Его нужно вставить в `app.js` в константу `TELEGRAM_PROXY_URL`.
