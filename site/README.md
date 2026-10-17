# Bloom · терминал документации

Сайт документации Bloom в стиле терминала. Он собирается из Markdown-файлов в `../docs/ru` и `../docs/en` и работает в двух режимах:

- **Статика (GitHub Pages).** Только `dist/web`: HTML, JS, CSS и `content.json`. Поиск и команды работают прямо в браузере.
- **Backend (Docker).** Node.js-сервер без runtime-зависимостей. Отдаёт ту же статику и публичное JSON API `/api/v1/*`.

## Команды терминала

| Команда | Что делает |
|---------|------------|
| `/help` | Все команды |
| `/docs` | Дерево глав |
| `/<глава>` | Открыть главу: `/canvas`, `/fonts`, `/errors`… |
| `/open <глава>` | Открыть главу по нечёткому имени |
| `/fn <функция>` | Перейти к функции: `/fn DrawLine`, `/fn Bloom.Create` |
| `/api` | Справочник всех функций |
| `/search <текст>` | Полнотекстовый поиск. Текст без `/` тоже ищется |
| `/theme [имя]` | Темы: `mono` (чёрная, по умолчанию) и `paper` (белая) |
| `/fx [on\|off]` | Фон со световыми волнами (`/crt` тоже работает) |
| `/lang [ru\|en]` | Сменить язык. Кнопка `RU / EN` в шапке делает то же самое |
| `/credits` | Титры: ссылка на git, авторы, донаты, ссылки, благодарности |
| `/history`, `/about`, `/welcome`, `/clear` | Служебные команды |

Горячие клавиши: `/` или `Ctrl K` переводят фокус в строку ввода, `Ctrl L` очищает экран, `↑ ↓` листают историю или подсказки, `Tab` дополняет, `Esc` закрывает подсказки.

## Языки

Документация лежит в двух папках: `docs/ru` и `docs/en`. В них одинаковые имена файлов, поэтому команды и ссылки (`/canvas`, `#/canvas/bloom-create`) работают на обоих языках. Если главы или функции в папках расходятся, сборка и тесты падают.

Язык сайта выбирается так: сначала сохранённый выбор, потом язык браузера, потом русский. При переключении глава и якорь функции остаются на месте.

## Титры

Заполни [`credits.json`](credits.json): ссылку на репозиторий, авторов, донаты, другие ссылки, благодарности и лицензию. Пустые записи не показываются. Пока всё пусто, команда `/credits` показывает подсказку, где это заполнить.

```json
{
  "project": "Bloom",
  "repository": "https://github.com/<user>/<repo>",
  "license": "MIT",
  "authors": [{ "name": "Имя", "role": "библиотека и документация", "url": "https://github.com/<user>" }],
  "donations": [{ "label": "Boosty", "url": "https://boosty.to/<user>" }],
  "links": [{ "label": "Discord", "url": "https://discord.gg/<invite>" }],
  "thanks": [{ "name": "Кому спасибо", "role": "", "url": "" }]
}
```

Где появляются титры:

- кнопка `git ↗` в шапке;
- блок ссылок внизу боковой панели;
- команда `/credits`.

Сборка проверяет файл: ссылки только `https://`, строки однострочные и не длиннее 120 символов, в каждом списке не больше 30 записей.

## Разработка

Нужен Node.js 24+.

```bash
npm ci
npm run build
npm start
```

Сайт откроется на `http://localhost:8080`. Чтобы пересобирать его при каждом изменении `docs/`, `frontend/`, `shared/` или `backend/`, запусти:

```bash
npm run dev
```

Проверки (TypeScript в строгом режиме, затем тесты `node:test`):

```bash
npm run check
npm audit
```

## Docker

Образ собирается из корня репозитория, потому что ему нужна папка `docs/`.

```bash
docker compose -f site/compose.yaml up --build
```

Что сделано для безопасности контейнера:

- двухэтапная сборка: на первом этапе typecheck, тесты и сборка, а в итоговом образе только `dist/`;
- итоговый образ - distroless `nodejs24-debian13:nonroot`: без shell и пакетного менеджера, запуск не от root;
- оба базовых образа закреплены по digest, их обновляет Dependabot;
- в `compose.yaml`: файловая система только для чтения, `cap_drop: ALL`, `no-new-privileges`, лимиты памяти, CPU и процессов, порт открыт только на `127.0.0.1`;
- `HEALTHCHECK` обращается к `/api/v1/health`.

| Переменная | По умолчанию | Что задаёт |
|------------|--------------|------------|
| `PORT` | `8080` | Порт |
| `HOST` | `0.0.0.0` | Адрес, на котором слушает сервер |
| `TRUST_PROXY` | `false` | Брать IP клиента из `X-Forwarded-For` (только за своим reverse proxy) |
| `RATE_LIMIT_BURST` | `120` | Размер token bucket на один IP |
| `RATE_LIMIT_PER_SECOND` | `20` | Скорость пополнения bucket |
| `LOG_REQUESTS` | `true` | JSON-логи запросов |
| `WEB_ROOT` | `dist/web` | Папка со статикой |

## GitHub Pages

Сайт опубликован на **https://framebuffer-studio.github.io/Bloom/**. Файлы лежат в папке `Bloom/` репозитория [FrameBuffer-Studio/framebuffer-studio.github.io](https://github.com/FrameBuffer-Studio/framebuffer-studio.github.io).

Workflow `.github/workflows/site.yml` при каждом push в `main` делает следующее:

1. запускает `npm audit`, typecheck и тесты;
2. собирает сайт и Docker-образ;
3. кладёт `site/dist/web` в папку `Bloom/` репозитория `framebuffer-studio.github.io`.

Для третьего шага нужен секрет `PAGES_DEPLOY_TOKEN` в настройках репозитория Bloom. Это fine-grained токен с доступом **Contents: Read and write** только к репозиторию `framebuffer-studio.github.io`. Без секрета шаг публикации пропускается, а проверки и сборка всё равно работают.

Все пути на сайте относительные, а навигация идёт через hash (`#/canvas/bloom-create`), поэтому сайт работает в подпапке `/Bloom/`.

## API

| Запрос | Ответ |
|--------|-------|
| `?lang=ru\|en` | Язык ответа для любого запроса (по умолчанию `ru`) |
| `GET /api/v1/health` | `{ status, version, sections, functions, uptimeSeconds }` |
| `GET /api/v1/sections` | Список глав |
| `GET /api/v1/sections/:slug` | Глава целиком (AST блоков) |
| `GET /api/v1/functions?q=` | Все функции или нечёткий поиск по ним |
| `GET /api/v1/functions/:name` | Функция по имени (`DrawLine`, `canvas:DrawLine`) |
| `GET /api/v1/search?q=&limit=` | Полнотекстовый поиск (`q` до 100 символов, `limit` от 1 до 50) |

## Безопасность

- **Нет XSS через документацию.** Markdown разбирается в AST при сборке, а браузер строит DOM только через `createElement` и `textContent`. `innerHTML` не используется нигде.
- **Строгая CSP.** `default-src 'none'`, скрипты и стили только с `'self'`, без `unsafe-inline`, и включён `require-trusted-types-for 'script'`.
- **Целостность файлов.** Скрипт и стили подключены с Subresource Integrity (`sha384`), а имена файлов содержат хэш.
- **Безопасные ссылки.** Разрешены только `http(s):` и внутренние `#/…`. Внешние ссылки открываются с `noopener noreferrer`.
- **Статика в памяти.** Сервер загружает её в память при старте, поэтому запрос не может обратиться к файловой системе. `..`, NUL и обратные слэши отклоняются.
- **Ограничения запросов.** Принимаются только `GET`, `HEAD` и `OPTIONS`. Есть лимиты на длину URL и заголовков, таймауты запросов, rate limit по IP с `Retry-After` и валидация параметров API.
- **Заголовки.** Сервер отдаёт CSP с `frame-ancestors 'none'`, HSTS, `nosniff`, `X-Frame-Options`, COOP/CORP, `Referrer-Policy: no-referrer` и `Permissions-Policy`.
- **Зависимости.** Только dev-зависимости (`typescript`, `esbuild`, `@types/node`), версии точные. В `.npmrc` стоит `ignore-scripts=true`, `npm audit` показывает 0 уязвимостей.

GitHub Pages не позволяет задавать HTTP-заголовки, поэтому в статическом режиме CSP передаётся через `<meta>`. `frame-ancestors` через `<meta>` не работает: эта защита есть только в Docker-режиме.

## Структура

```text
site/
├── frontend/   index.html, стили, TypeScript терминала
├── backend/    HTTP-сервер, API, rate limit, healthcheck
├── shared/     парсер Markdown, компилятор документации, поиск, CSP
├── scripts/    сборка (esbuild + content.json + SRI)
└── tests/      node:test - парсер, ссылки в docs, поиск, сервер
```
