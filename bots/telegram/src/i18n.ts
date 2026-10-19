/**
 * Bot texts. Lithuanian is the default; Russian is chosen from the Telegram
 * client language or with /ru. Field and option labels are taken from the
 * site's own dictionaries so the bot and the site never disagree.
 */

import lt from '../../../src/i18n/dictionaries/lt.json';
import ru from '../../../src/i18n/dictionaries/ru.json';

export type Lang = 'lt' | 'ru';

export const SITE_DICT = { lt, ru } as const;

export function langFromTelegram(code: string | undefined): Lang {
  return code !== undefined && /^(ru|uk|be)\b/i.test(code) ? 'ru' : 'lt';
}

const T = {
  lt: {
    welcome:
      'Sveiki! Atsiųsk 1–10 padangų nuotraukų (šoną su užrašais, protektorių, DOT kodą). ' +
      'Aš perskaitysiu, ką matau, paklausiu, ko trūksta, ir paruošiu skelbimą lietuvių ir rusų kalbomis.',
    tips:
      'Patarimas: nufotografuok šoną taip, kad būtų įskaitomas dydis (pvz. 205/55 R16) ir DOT kodas. ' +
      'Jei turi protektoriaus gylio matuoklį — nufotografuok ir jį.',
    photoReceived: (n: number) => `Gauta nuotraukų: ${n}. Siųsk daugiau arba spausk „Analizuoti“.`,
    analyse: '🔍 Analizuoti',
    analysing: 'Skaitau nuotraukas…',
    tooManyPhotos: 'Daugiausia 10 nuotraukų vienam skelbimui.',
    noPhotos: 'Pirmiausia atsiųsk bent vieną nuotrauką.',
    notTyres: 'Nuotraukose nematau padangų. Atsiųsk kitas nuotraukas.',
    mixedTyres:
      'Atrodo, kad nuotraukose skirtingos padangos. Vienas skelbimas — vienas dydis ir modelis. ' +
      'Tęsiu, bet patikrink duomenis.',
    visionFailed: 'Nepavyko perskaityti nuotraukų. Užpildysime rankiniu būdu — atsakyk į kelis klausimus.',
    readFromPhotos: 'Iš nuotraukų perskaičiau:',
    foundNothing: 'Iš nuotraukų nieko tikslaus perskaityti nepavyko — paklausiu.',
    confirm: (label: string, value: string) => `${label}: ${value}?\nAr teisingai?`,
    yes: '✅ Taip',
    no: '✏️ Ne, įvesiu',
    yesBool: 'Taip',
    noBool: 'Ne',
    skip: 'Nežinau / praleisti',
    none: 'Nėra',
    invalid: 'Nesupratau. Pabandyk dar kartą.',
    useText: 'Atsakyk mygtuku arba parašyk.',
    summary: 'Skelbimas paruoštas. Patikrink:',
    done: '✅ Viskas gerai',
    edit: '✏️ Pataisyti',
    restart: '🔄 Iš naujo',
    chooseEdit: 'Ką pataisyti?',
    final:
      'Paruošta! Žemiau — tekstas lietuviškai ir rusiškai, galima kopijuoti. ' +
      'Kitai pozicijai atsiųsk naujas nuotraukas.',
    invalidDraft: 'Kai kurie duomenys neatitinka svetainės taisyklių:',
    restarted: 'Pradėkime iš naujo. Atsiųsk nuotraukas.',
    notAllowed: 'Šis botas skirtas tik RATATAI komandai.',
    langSet: 'Kalba: lietuvių.',
    textLt: '🇱🇹 Lietuviškai',
    textRu: '🇷🇺 Rusiškai',
    search:
      'Paieška: parašyk arba pasakyk balsu, pvz. „205/55 R16 žieminės Nokian“ ar „R16 dygliuotos iki 200“. ' +
      '/all — visos pozicijos, #12 — pozicija pagal numerį.',
    saved: (id: number) => `💾 Išsaugota bazėje kaip #${id}.`,
    found: (desc: string, n: number) => `🔎 ${desc} — rasta: ${n}`,
    nothingFound: 'Nieko nerasta.',
    relaxed: (word: string) => `Su „${word}“ nieko nėra — rodau be šio žodžio.`,
    heard: (text: string) => `🎤 „${text}“`,
    voiceFailed: 'Nepavyko atpažinti balso. Pabandyk dar kartą arba parašyk.',
    voiceOff: 'Balso atpažinimas neįjungtas — parašyk tekstu.',
    more: '⬇️ Daugiau',
    allPhotos: (n: number) => `📷 Nuotraukos (${n})`,
    markSold: '✅ Parduota',
    markActive: '↩️ Grąžinti į prekybą',
    remove: '🗑 Ištrinti',
    confirmDelete: (id: number) => `Ištrinti #${id}? To atšaukti negalima.`,
    deleteYes: 'Taip, ištrinti',
    deleted: (id: number) => `#${id} ištrinta.`,
    soldMark: 'PARDUOTA',
    statusSold: (id: number) => `#${id} pažymėta kaip parduota.`,
    statusActive: (id: number) => `#${id} vėl parduodama.`,
    notFound: 'Tokios pozicijos nėra.',
    skipWords: ['nežinau', 'praleisti', 'nėra', 'ne'],
    q: {
      size: 'Koks padangų dydis? Parašyk kaip ant šono, pvz. 205/55 R16.',
      brand: 'Koks gamintojas? (pvz. Michelin)',
      season: 'Koks sezonas?',
      condition: 'Kokia būklė?',
      tread_depth: 'Koks protektoriaus gylis milimetrais? (pvz. 6,5)',
      quantity: 'Kiek padangų parduodi?',
      sale_unit: 'Kaip parduodi?',
      price: 'Kokia kaina eurais už visas parduodamas padangas?',
      city: 'Kuriame mieste?',
      model: 'Koks modelis? (pvz. Primacy 4)',
      load_speed: 'Apkrovos ir greičio indeksas? (pvz. 91V)',
      dot: 'DOT kodas arba bent paskutiniai 4 skaitmenys (savaitė ir metai, pvz. 4521)?',
      xl: 'Ar padangos XL / sustiprintos?',
      run_flat: 'Ar tai Run Flat padangos?',
      studded: 'Ar padangos dygliuotos?',
      defects: 'Ar yra defektų ar remontų (įpjovos, išsipūtimai, lopai)? Jei yra — parašyk.',
    },
  },
  ru: {
    welcome:
      'Здравствуйте! Пришлите 1–10 фото шин (боковину с надписями, протектор, DOT-код). ' +
      'Я прочитаю, что видно, спрошу недостающее и подготовлю объявление на литовском и русском.',
    tips:
      'Совет: снимайте боковину так, чтобы читались размер (например 205/55 R16) и DOT-код. ' +
      'Если есть глубиномер протектора — сфотографируйте и его.',
    photoReceived: (n: number) => `Фото получено: ${n}. Пришлите ещё или нажмите «Анализировать».`,
    analyse: '🔍 Анализировать',
    analysing: 'Читаю фотографии…',
    tooManyPhotos: 'Максимум 10 фото на одно объявление.',
    noPhotos: 'Сначала пришлите хотя бы одно фото.',
    notTyres: 'На фото не видно шин. Пришлите другие фото.',
    mixedTyres:
      'Похоже, на фото разные шины. Одно объявление — один размер и модель. ' +
      'Продолжаю, но проверьте данные.',
    visionFailed: 'Не удалось прочитать фото. Заполним вручную — ответьте на несколько вопросов.',
    readFromPhotos: 'С фото прочитал:',
    foundNothing: 'Точно прочитать с фото ничего не удалось — спрошу.',
    confirm: (label: string, value: string) => `${label}: ${value}?\nВерно?`,
    yes: '✅ Да',
    no: '✏️ Нет, введу',
    yesBool: 'Да',
    noBool: 'Нет',
    skip: 'Не знаю / пропустить',
    none: 'Нет',
    invalid: 'Не понял. Попробуйте ещё раз.',
    useText: 'Ответьте кнопкой или напишите.',
    summary: 'Объявление готово. Проверьте:',
    done: '✅ Всё верно',
    edit: '✏️ Исправить',
    restart: '🔄 Заново',
    chooseEdit: 'Что исправить?',
    final:
      'Готово! Ниже — текст на литовском и русском, можно копировать. ' +
      'Для следующей позиции пришлите новые фото.',
    invalidDraft: 'Некоторые данные не проходят правила сайта:',
    restarted: 'Начнём заново. Пришлите фото.',
    notAllowed: 'Этот бот только для команды RATATAI.',
    langSet: 'Язык: русский.',
    textLt: '🇱🇹 На литовском',
    textRu: '🇷🇺 На русском',
    search:
      'Поиск: напишите или скажите голосом, например «205/55 R16 зимние Nokian» или «R16 шипы до 200». ' +
      '/all — все позиции, #12 — позиция по номеру.',
    saved: (id: number) => `💾 Сохранено в базе как #${id}.`,
    found: (desc: string, n: number) => `🔎 ${desc} — найдено: ${n}`,
    nothingFound: 'Ничего не найдено.',
    relaxed: (word: string) => `С «${word}» ничего нет — показываю без этого слова.`,
    heard: (text: string) => `🎤 «${text}»`,
    voiceFailed: 'Не удалось распознать голос. Попробуйте ещё раз или напишите.',
    voiceOff: 'Распознавание голоса не включено — напишите текстом.',
    more: '⬇️ Ещё',
    allPhotos: (n: number) => `📷 Фото (${n})`,
    markSold: '✅ Продано',
    markActive: '↩️ Вернуть в продажу',
    remove: '🗑 Удалить',
    confirmDelete: (id: number) => `Удалить #${id}? Отменить нельзя.`,
    deleteYes: 'Да, удалить',
    deleted: (id: number) => `#${id} удалено.`,
    soldMark: 'ПРОДАНО',
    statusSold: (id: number) => `#${id} отмечено как проданное.`,
    statusActive: (id: number) => `#${id} снова в продаже.`,
    notFound: 'Такой позиции нет.',
    skipWords: ['не знаю', 'пропустить', 'нет', 'пропусти'],
    q: {
      size: 'Какой размер шин? Напишите как на боковине, например 205/55 R16.',
      brand: 'Какой производитель? (например Michelin)',
      season: 'Какой сезон?',
      condition: 'Какое состояние?',
      tread_depth: 'Какая глубина протектора в миллиметрах? (например 6,5)',
      quantity: 'Сколько шин продаёте?',
      sale_unit: 'Как продаёте?',
      price: 'Какая цена в евро за все продаваемые шины?',
      city: 'В каком городе?',
      model: 'Какая модель? (например Primacy 4)',
      load_speed: 'Индекс нагрузки и скорости? (например 91V)',
      dot: 'DOT-код или хотя бы последние 4 цифры (неделя и год, например 4521)?',
      xl: 'Шины XL / усиленные?',
      run_flat: 'Это шины Run Flat?',
      studded: 'Шины шипованные?',
      defects: 'Есть ли дефекты или ремонты (порезы, грыжи, латки)? Если есть — напишите.',
    },
  },
} as const;

export type Texts = (typeof T)['lt'] | (typeof T)['ru'];

export function t(lang: Lang): Texts {
  return T[lang];
}
