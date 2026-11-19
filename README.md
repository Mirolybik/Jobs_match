# JobsMatch API

Бэкенд сервиса подбора подработки по **недельному графику доступности**. Соискатель заполняет
свободные часы, работодатель публикует вакансии с рабочими часами, а сервис объясняет, подходит
ли вакансия: **рабочие часы вакансии должны полностью входить в свободные часы соискателя**.

## Стек

| Слой | Технология |
| --- | --- |
| Runtime | Node.js 24+ |
| Фреймворк | NestJS 12 |
| Язык | TypeScript 6 |
| БД | PostgreSQL 17 |
| ORM | Prisma 6 |
| Авторизация | JWT (access + refresh с ротацией), bcrypt |
| Документация | Swagger / OpenAPI — `/docs` |
| Тесты | Jest (доменные unit-тесты), node:test + supertest (e2e) |
| Контейнеры | Docker, Docker Compose, Caddy (HTTPS) |

## Архитектура

```
src/
├── common/                  # сквозные вещи: ошибки, guard'ы, DTO, утилиты
│   ├── decorators/          # @Public, @Roles, @CurrentUser
│   ├── dto/                 # пагинация, слот графика
│   ├── errors/              # доменные ошибки (Validation, NotFound, Conflict...)
│   ├── filters/             # единый формат HTTP-ошибок, обработка Prisma P2002/P2025
│   ├── guards/              # JwtAuthGuard (глобальный), RolesGuard
│   ├── middleware/          # структурированный HTTP-журнал + X-Request-Id
│   ├── request-context/     # AsyncLocalStorage: requestId, IP, пользователь
│   ├── types/               # AuthenticatedUser
│   └── utils/               # деньги: рубли ⇄ копейки
├── config/                  # валидация env через Joi
├── database/                # PrismaModule / PrismaService
├── modules/
│   ├── auth/                # регистрация, login, refresh, logout
│   ├── candidates/          # профиль соискателя и график доступности
│   ├── companies/           # компания работодателя
│   ├── vacancies/           # CRUD вакансий, каталог, публикация/закрытие
│   ├── matching/            # домен матчинга (value objects + сервис)
│   ├── applications/        # отклики, снимок условий, статусы, история
│   ├── complaints/          # жалобы на вакансии и отклики
│   ├── admin/               # модерация, пользователи, компании, журнал
│   ├── audit/               # журнал действий (AuditLog)
│   ├── users/               # презентеры пользователей
│   └── health/              # health-check с проверкой БД
├── app.module.ts
└── main.ts
```

Ключевая идея — **домен не зависит от Nest и Prisma**:

- `modules/matching/domain/` — `TimeOfDay`, `WeeklyInterval`, `WeeklySchedule`, `VacancyMatch`;
- `modules/applications/domain/` — `ApplicationSnapshot`, `ApplicationStatusPolicy`.

Сервисы (`*.service.ts`) оркестрируют репозитории и домен, репозитории (`*.repository.ts`) —
единственное место с запросами к Prisma, презентеры (`*.presenter.ts`) формируют контракт API.
Контроллеры не содержат бизнес-логики.

## Правила домена

### График

- День недели: `1..7` (понедельник–воскресенье).
- Время: минуты от начала суток, `0..1440`; конец интервала — не позже `24:00`.
- Интервалы одного дня нормализуются: пересекающиеся и смежные (`18:00–20:00` + `20:00–22:00`)
  объединяются.
- Пустой график доступности — валидное состояние профиля, но матчинг вернёт `NO_AVAILABILITY`.

### Матчинг

`VacancyMatch.evaluate(vacancySchedule, candidateSchedule, { hourlyRate, minHourlyRate })`
возвращает:

| Статус | Значение |
| --- | --- |
| `MATCHED` | все рабочие часы вакансии покрыты графиком соискателя |
| `MISMATCHED` | есть непокрытые куски |
| `NO_AVAILABILITY` | соискатель ещё не заполнил график |

Дополнительно возвращаются:

- `reasons` — человекочитаемая причина, например `Среда: не хватает 12:00–17:00.`;
- `warnings` — не блокирующие замечания (ставка ниже минимума соискателя);
- `days[]` — разбивка по дням с интервалами вакансии и недостающими кусками;
- `weeklyMinutes`, `weeklyHours`, `hourlyRate`, `estimatedWeeklyPay`.

Деньги считаются в **копейках целыми числами**, оплата за неделю округляется до копейки.
Наружу отдаются рубли (число с точностью до копеек).

### Отклик

При отклике сервер сохраняет **снимок условий вакансии**, чтобы дальнейшие правки вакансии не
меняли историю:

- ставка (`snapshotRateKopecks`);
- город и адрес;
- график (`snapshotSchedule`);
- срок ответа (`snapshotDeadlineHours`);
- момент отклика (`snapshotTakenAt`) и дедлайн (`deadlineAt`).

Статусы: `PENDING → INVITED | REJECTED | WITHDRAWN`. Решение принимается только по `PENDING`,
отозвать можно `PENDING` и `INVITED`. В ответах есть `statusLabel`, `canWithdraw`, `canDecide`,
`responseOverdue` (дедлайн прошёл, а решения нет) — обе стороны видят одно и то же состояние.

Каждый переход статуса пишется в **историю отклика** (`ApplicationStatusEvent`): предыдущий и
новый статус, автор действия и время. История возвращается в карточке отклика полем `history` и
отдельным маршрутом `GET /applications/:id/history`; она доступна обеим сторонам и администратору.

Переменная `REQUIRE_SCHEDULE_MATCH=true` (по умолчанию) запрещает отклик при неполном совпадении
графика — API вернёт `422 SCHEDULE_MISMATCH` с причинами. Если поставить `false`, отклик
разрешён, а расхождение остаётся в карточке отклика как предупреждение.

### Журнал действий

Все значимые операции (регистрация, вход, изменения профиля и графика, публикация/снятие вакансий,
отклики и решения, жалобы, блокировки) пишутся в `AuditLog`: действие, тип и id сущности, автор,
роль, IP и User-Agent из контекста запроса. Сбой записи журнала не ломает бизнес-операцию.
Журнал доступен администратору через `GET /admin/audit-logs` с фильтрами по действию, сущности,
автору и периоду.

HTTP-запросы логируются структурированным JSON (`requestId`, method, path, status, durationMs,
userId, ip); клиенту возвращается заголовок `X-Request-Id` — его удобно указывать при разборе
инцидентов.

### Роли

`CANDIDATE` — профиль и график, каталог, отклики; `EMPLOYER` — компания, вакансии, решения по
откликам; `ADMIN` — все вакансии, жалобы, пользователи и компании, журнал действий.

Администратор может заблокировать пользователя (`ACTIVE`/`BLOCKED`) и приостановить компанию
(`ACTIVE`/`SUSPENDED`). Блокировка отзывает все refresh-токены пользователя, а его access-токены
перестают приниматься сразу (статус проверяется в `JwtAuthGuard`). Вакансии приостановленной
компании исчезают из каталога и не дают создавать/публиковать новые.

## Быстрый старт (локально)

```bash
# 1. Зависимости
npm install

# 2. Переменные окружения
cp .env.example .env
# затем замените JWT-секреты, например: openssl rand -hex 32

# 3. PostgreSQL
docker compose up -d db

# 4. Схема и демо-данные
npx prisma migrate deploy   # или npm run prisma:migrate для разработки
npm run db:seed

# 5. Запуск
npm run start:dev
```

- API: <http://localhost:3000/api/v1>
- Swagger: <http://localhost:3000/docs>
- Health: <http://localhost:3000/api/v1/health>

### Полный запуск в Docker

```bash
docker compose up --build
```

`app` дождётся готовности `db`, выполнит `prisma migrate deploy` и стартует. Демо-данные в
контейнере автоматически не загружаются — выполните:

```bash
docker compose exec app npx prisma db seed
```

### HTTPS-стенд

В compose входит `caddy`: он терминирует TLS и проксирует запросы в `app`. Используется
внутренний CA Caddy, поэтому сертификат самоподписанный (для локального стенда это нормально).

- HTTPS API: <https://localhost:8443/api/v1>
- HTTPS Swagger: <https://localhost:8443/docs>
- HTTP напрямую: <http://localhost:3000/api/v1>

```bash
curl -k https://localhost:8443/api/v1/health
```

В контейнере включён `TRUST_PROXY=true`, чтобы IP клиента в журнале брался из `X-Forwarded-For`.
Для доверия сертификату можно импортировать корневой сертификат Caddy из тома `caddy_data`
(`/data/caddy/pki/authorities/local/root.crt`).

## Переменные окружения

| Переменная | Обязательна | По умолчанию | Назначение |
| --- | --- | --- | --- |
| `NODE_ENV` | нет | `development` | режим работы |
| `PORT` | нет | `3000` | порт HTTP |
| `API_PREFIX` | нет | `api/v1` | префикс API |
| `DATABASE_URL` | да | — | строка подключения PostgreSQL |
| `JWT_ACCESS_SECRET` | да | — | секрет access-токена, ≥ 32 символов |
| `JWT_REFRESH_SECRET` | да | — | секрет refresh-токена, ≥ 32 символов |
| `JWT_ACCESS_TTL_SECONDS` | нет | `900` | время жизни access-токена |
| `JWT_REFRESH_TTL_SECONDS` | нет | `2592000` | время жизни refresh-токена |
| `BCRYPT_ROUNDS` | нет | `12` | стоимость хеширования пароля |
| `CORS_ORIGINS` | нет | `http://localhost:5173` | список origin через запятую или `*` |
| `TRUST_PROXY` | нет | `false` | доверять `X-Forwarded-For` (включено за Caddy) |
| `REQUIRE_SCHEDULE_MATCH` | нет | `true` | требовать полное совпадение графика для отклика |

Конфигурация валидируется при старте (Joi), приложение не поднимется с некорректным `.env`.

## Демо-аккаунты (после `npm run db:seed`)

| Роль | Email | Пароль |
| --- | --- | --- |
| ADMIN | `admin@jobsmatch.ru` | `Admin12345` |
| CANDIDATE | `anna@jobsmatch.ru` | `Candidate123` |
| CANDIDATE | `oleg@jobsmatch.ru` | `Candidate123` |
| EMPLOYER | `hr@ritm.ru` | `Employer123` |

В сиде есть вакансия «Бариста» (Вт/Чт 18:00–22:00, 400 ₽/ч), совпадающая с графиком Анны и
Олега, несовпадающая вакансия «Продавец-консультант» (Ср 12:00–17:00), черновик, отклики и жалоба.

## API

Все маршруты ниже относительно `/api/v1`. Авторизация — `Authorization: Bearer <accessToken>`.

### Авторизация

| Метод | Путь | Доступ | Описание |
| --- | --- | --- | --- |
| POST | `/auth/register/candidate` | public | регистрация соискателя |
| POST | `/auth/register/employer` | public | регистрация работодателя + компания |
| POST | `/auth/login` | public, rate limit | вход, возвращает пару токенов |
| POST | `/auth/refresh` | public | обновление пары с ротацией refresh |
| POST | `/auth/logout` | public | отзыв refresh-токена |
| GET | `/auth/me` | any | текущий пользователь с профилем |

### Профили

| Метод | Путь | Доступ | Описание |
| --- | --- | --- | --- |
| GET | `/candidates/me` | candidate | профиль и график |
| PATCH | `/candidates/me` | candidate | профиль, минимальная ставка |
| PUT | `/candidates/me/availability` | candidate | заменить график доступности |
| GET | `/companies/me` | employer | моя компания |
| POST | `/companies` | employer | создать компанию (fallback) |
| PATCH | `/companies/me` | employer | обновить компанию |

### Вакансии

| Метод | Путь | Доступ | Описание |
| --- | --- | --- | --- |
| GET | `/vacancies` | optional auth | каталог опубликованных вакансий |
| GET | `/vacancies/mine` | employer | все мои вакансии, включая черновики |
| GET | `/vacancies/:id` | optional auth | карточка вакансии |
| GET | `/vacancies/:id/match` | candidate | детальный разбор совпадения |
| POST | `/vacancies` | employer | создать вакансию (черновик) |
| PATCH | `/vacancies/:id` | employer | изменить вакансию |
| POST | `/vacancies/:id/publish` | employer | опубликовать |
| POST | `/vacancies/:id/close` | employer | закрыть |

Фильтры каталога: `city`, `minHourlyRate`, `search`, `dayOfWeek`, `from`, `to`, `onlyMatching`,
`page`, `pageSize`. Если передан access-токен соискателя, каждая вакансия получает блок `match`.

### Отклики

| Метод | Путь | Доступ | Описание |
| --- | --- | --- | --- |
| POST | `/vacancies/:id/applications` | candidate | откликнуться (сохраняет снимок) |
| GET | `/vacancies/:id/applications` | employer (владелец) | отклики на вакансию |
| GET | `/applications/me` | candidate | история откликов |
| GET | `/applications/:id` | участник / admin | карточка отклика (со снимком и историей) |
| GET | `/applications/:id/history` | участник / admin | история статусов отклика |
| POST | `/applications/:id/withdraw` | candidate | отозвать |
| POST | `/applications/:id/invite` | employer | пригласить |
| POST | `/applications/:id/reject` | employer | отказать |

### Жалобы и администрирование

| Метод | Путь | Доступ | Описание |
| --- | --- | --- | --- |
| POST | `/complaints` | any | жалоба на вакансию **или** отклик |
| GET | `/complaints/me` | any | мои жалобы и их статусы |
| GET | `/admin/vacancies` | admin | все вакансии с фильтрами |
| POST | `/admin/vacancies/:id/remove` | admin | снять вакансию с публикации |
| GET | `/admin/complaints` | admin | список жалоб |
| GET | `/admin/complaints/:id` | admin | карточка жалобы |
| PATCH | `/admin/complaints/:id` | admin | `RESOLVED` / `REJECTED` + комментарий; `removeVacancy: true` снимает вакансию |
| GET | `/admin/users` | admin | пользователи (`role`, `status`, `search`) |
| PATCH | `/admin/users/:id/status` | admin | `ACTIVE` / `BLOCKED` |
| GET | `/admin/companies` | admin | компании (`status`, `search`) |
| PATCH | `/admin/companies/:id/status` | admin | `ACTIVE` / `SUSPENDED` |
| GET | `/admin/audit-logs` | admin | журнал действий с фильтрами |
| GET | `/health` | public | статус API и БД |

## Формат ошибок

Единый JSON для всех исключений:

```json
{
  "statusCode": 422,
  "code": "SCHEDULE_MISMATCH",
  "message": "График вакансии не совпадает с вашим графиком",
  "details": { "match": { "status": "MISMATCHED", "reasons": ["Среда: не хватает 12:00–17:00."] } },
  "path": "/api/v1/vacancies/...",
  "timestamp": "2026-11-19T16:43:00.000Z"
}
```

Ошибки Prisma `P2002` (уникальность) и `P2025` (запись не найдена) преобразуются в `409` и `404`.
Неизвестные поля в теле запроса отклоняются (`forbidNonWhitelisted`).

## Тесты и качество

```bash
npm test            # доменные unit-тесты (15 тестов)
npm run test:cov    # покрытие
npm run test:e2e    # сквозной сценарий на отдельной schema e2e
npm run lint        # ESLint + typescript-eslint
npm run build       # компиляция в dist/
```

Покрыты нормализация графика, вложение интервалов, причины расхождения, недельная оплата,
снимок отклика и политика статусов.

E2E-тесты (`test/app.e2e.test.mjs`, `node:test` + `supertest`) поднимают приложение на schema
`e2e` (переменные из `.env.test`), очищают таблицы и проходят полный сценарий: регистрация →
график → вакансия → матчинг → отклик со снимком → история статусов → жалоба → модерация →
блокировка пользователя → приостановка компании → журнал действий. Перед запуском база должна
быть поднята (`docker compose up -d db`); миграции применяются автоматически.

## Решения и ограничения MVP

- **Node вместо Java** — по согласованию; слои и разделение ответственности сохранены.
- **Копейки и минуты** — деньги и время хранятся целыми числами, без плавающей точки.
- **Prisma 6 (CommonJS)** — выбрана совместимость с NestJS без ESM-адаптеров; Prisma 7+ потребовала
  бы `@prisma/adapter-pg` и другой режим запуска.
- **Матчинг в памяти** — каталог выбирает до 500 подходящих по SQL-фильтрам вакансий и фильтрует
  их по графику после загрузки. Для продакшена стоит вынести проверку в SQL/GiST или материализовать
  пересечения.
- **Refresh-токены** хранятся SHA-256 хешем в БД и ротируются при обновлении; logout отзывает токен.
- **История статусов и журнал** — отдельные таблицы; история отклика неизменяема, журнал доступен
  только администратору и не содержит секретов/паролей.
- **HTTPS-стенд** — Caddy с внутренним CA; для продакшена достаточно заменить адрес в `Caddyfile`
  на реальный домен (Caddy сам получит сертификат Let's Encrypt).
- **Нет подтверждения email, восстановления пароля и загрузки файлов** — вне рамок каркаса из ТЗ.
- **Админ создаётся только сидом** — отдельной публичной регистрации администратора нет.

## Полезные команды

```bash
npm run prisma:generate   # генерация Prisma Client
npm run prisma:migrate    # миграция в dev-режиме
npm run prisma:studio     # Prisma Studio
npm run db:seed           # демо-данные
npm run db:reset          # сброс БД + миграции + seed
npm run test:e2e          # e2e-сценарий на schema e2e
npm run format            # Prettier
```
