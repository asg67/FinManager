# FinManager — Дизайн-референсы

## Источники
6 Pinterest-скриншотов: Smart Home Dashboard (glassmorphism), Finance Dashboard (light), Crypto Dashboard (minimal).

## Извлечённые паттерны

### Layout
- **Sidebar слева** — иконки навигации (вертикальная полоса), компактный
- **Top bar** — табы для переключения разделов (ДДС / Выписки / Аналитика), поиск, уведомления, аватар
- **Card grid** — основной контент в карточках с rounded corners (16-20px)
- **Summary cards вверху** — ключевые метрики (остатки по счетам, общий приход/расход)

### Визуальный стиль
- **Glassmorphism** — полупрозрачные карточки с backdrop-blur (как на Smart Home референсе)
- **Мягкие тени** — box-shadow вместо бордеров
- **Большие числа** — суммы и балансы крупным шрифтом, чёткая типографическая иерархия
- **Accent color** — teal/бирюзовый (#14B8A6 или подобный) для активных элементов
- **Rounded elements** — кнопки, карточки, инпуты — всё скруглённое

### Компоненты (из референсов)
- **Карточка банковской карты** — визуальное представление карт/счетов (как на Finance Dashboard)
- **Line chart** — таймлайн баланса за период (с фильтрами: 7D/30D/90D)
- **Bar chart** — расходы по категориям за неделю/месяц
- **Transaction list** — история операций с иконками, суммами, статусами
- **Recent Activities sidebar** — последние действия справа
- **Toggle switches** — для настроек, переключения темы
- **Period tabs** — Today / Week / Month / Year

### Тёмная тема (Smart Home референс)
- Background: тёмно-серый (#1a1a2e или #18181b)
- Cards: полупрозрачные с blur (rgba(255,255,255,0.05))
- Text: white/light-gray
- Accent: teal/cyan (#06b6d4)

### Светлая тема (Finance/Crypto референсы)
- Background: светло-серый (#f5f5f5 или #fafafa)
- Cards: белые с тенью
- Text: dark (#1a1a1a)
- Accent: teal (#14b8a6) или чёрный

### Адаптив (мобильная версия)
- Sidebar → bottom tab bar
- Summary cards → горизонтальный скролл
- Charts → полная ширина
- Transaction list → карточки stack
