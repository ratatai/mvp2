# Повтор финального gate RATATAI — 3 ноября 2026

**PASS. Закрыт последний упавший функциональный gate. Все семь согласованных наборов теперь имеют успешный результат. Это не утверждение о полной готовности публикации.**

- Run: https://github.com/ratatai/mvp2/actions/runs/41536726403
- Job: https://github.com/ratatai/mvp2/actions/runs/41536726403/job/125590354330
- Workflow commit: `a842b3af3507d29ec5fcc52e043f6e46d7ae6efd`.
- Проверяемое приложение: `b580aa59aa6287609d696938c8364634c2f185c8`.
- Ветка: `review/release-verification`; PR: https://github.com/ratatai/mvp2/pull/37.
- Запущен ровно один новый workflow_dispatch после явного разрешения владельца; автоматические retries отключены.
- UTC: 2 ноября 22:22; Europe/Kiev: 3 ноября 00:22. Дата отчёта указана по часовому поясу пользователя.

## Результаты повторного прогона

| Набор | Ожидалось | Прошло | Упало | Пропущено | Flaky/повторы |
|---|---:|---:|---:|---:|---:|
| Поиск шин: desktop/mobile/narrow | 21 | 21 | 0 | 0 | 0 |
| Публичные формы, доступ, каталог, языки, адаптивность | 120 | 120 | 0 | 0 | 0 |
| Всего в этом прогоне | 141 | 141 | 0 | 0 | 0 |

Три ранее падавших варианта одного сценария `carries a category filter through as a query parameter` прошли в desktop, mobile и narrow. Тест раскрывает вторичные фильтры перед вводом цены; проверка параметра priceMin и сохранения категории после перезагрузки не ослаблена.

Проверены новая disposable Supabase PostgreSQL 17.11 (server_version_num 170011), 4/4 миграции и успешный шаг Stop and discard the local stack. Hosted Supabase, основная БД и реальные пользователи не использовались. В workflow есть информационное предупреждение о Node20 action runtimes, принудительно запускаемых GitHub на Node24; job завершился успешно.

## Совокупный результат семи gates

| Gate | Итог | Доказательство |
|---|---|---|
| Вход/сессия/выход + мобильное меню | 3/3 + 4/4 PASS | https://github.com/ratatai/mvp2/actions/runs/41111091139 |
| Изоляция продавцов | 8/8 групп PASS | https://github.com/ratatai/mvp2/actions/runs/41111346800 |
| Полный сценарий продавца | 1/1 PASS, три категории и шесть изображений | https://github.com/ratatai/mvp2/actions/runs/41112019794 |
| Поиск | 69/69 PASS | https://github.com/ratatai/mvp2/actions/runs/41112099935 |
| Результаты дисков | 30/30 PASS | https://github.com/ratatai/mvp2/actions/runs/41112195027 |
| Шины + публичные сценарии | 21/21 + 120/120 PASS после исправления теста | https://github.com/ratatai/mvp2/actions/runs/41536726403 |
| Результаты комплектов колёс | 30/30 PASS | https://github.com/ratatai/mvp2/actions/runs/41112308572 |

Итого: 278 браузерных тестов в наборах и отдельно восемь групп изоляции. Результаты шести gates от 30 октября сохранены, а не выданы за новые запуски. Их приложение — `8e4bbc129a959fa552a5af104a679a3928f35bb5`. Сравнение с `b580aa59aa6287609d696938c8364634c2f185c8` по src/, package.json и package-lock.json не содержит отличий (git diff exit 0); изменены только тест каталога, workflow и документация. Поэтому повтор неизменившихся шести gates не требовался.

## Что ещё открыто перед выпуском

- SSR-404: HTTP 404/noindex и браузерное отображение проверены, но исходный серверный HTML страницы ошибки пустой. Этот повтор дефект не исправляет.
- Полный roadmap-аудит не объявляется завершённым только на основании этих семи наборов.
- Ревью и объединение PR, проверка текущего состояния основной БД и согласование необходимых миграций, финальная сборка с целевыми public env и публикация остаются отдельными действиями.
- В этом сеансе main не объединялся, hosted migrations и публикация не выполнялись.

## Санитизированные выдержки job log

```text
2026-11-02T22:23:55.1933015Z Local server_version_num: 170011
2026-11-02T22:23:55.2458423Z Applied migrations: 4 / 4
2026-11-02T22:25:33.7078420Z   21 passed (38.2s)
2026-11-02T22:25:33.7797814Z Verified 21/21 passed, zero skipped, failed, flaky or retried.
2026-11-02T22:25:58.6029468Z   ✓   19 [desktop] › tests/e2e/catalog.spec.ts:98:7 › public catalog › carries a category filter through as a query parameter (840ms)
2026-11-02T22:26:12.1716563Z   ✓   59 [mobile] › tests/e2e/catalog.spec.ts:98:7 › public catalog › carries a category filter through as a query parameter (498ms)
2026-11-02T22:26:25.1357773Z   ✓   99 [narrow] › tests/e2e/catalog.spec.ts:98:7 › public catalog › carries a category filter through as a query parameter (456ms)
2026-11-02T22:26:31.1801368Z   120 passed (56.8s)
2026-11-02T22:26:31.2515530Z Verified 120/120 passed, zero skipped, failed, flaky or retried.
2026-11-02T22:26:40.0972014Z Post job cleanup.
2026-11-02T22:26:40.2078981Z Post job cleanup.
2026-11-02T22:26:40.3941164Z Cleaning up orphan processes
```
