/**
 * Legal document content.
 *
 * The privacy policy and the terms of use are plain data rather than
 * translation-dictionary keys: they are long, they change as a block, and a
 * lawyer reviewing them should be able to read one document end to end instead
 * of hunting through a flat JSON file.
 *
 * Lithuanian is the authoritative version — `ru` and `en` are translations of
 * it. Every document describes the system as it actually works: no payments,
 * no chat, no delivery, no analytics or advertising cookies.
 */

import type { Locale } from '@/i18n/config';

export interface LegalSection {
  readonly heading: string;
  readonly paragraphs: readonly string[];
}

export interface LegalDocument {
  readonly intro: string;
  readonly sections: readonly LegalSection[];
  /** ISO date, rendered through `formatDate` in the visitor's language. */
  readonly lastUpdated: string;
}

const LAST_UPDATED = '2026-09-19';

const CONTACT_EMAIL = 'ratatailt@gmail.com';

/* -------------------------------------------------------------------------- */
/* Privacy policy                                                             */
/* -------------------------------------------------------------------------- */

const PRIVACY_LT: LegalDocument = {
  intro:
    'RATATAI yra atviro kodo skelbimų lenta, kurioje privatūs asmenys ir įmonės ' +
    'skelbia parduodamas padangas, ratlankius ir komplektinius ratus. Ši privatumo ' +
    'politika paaiškina, kokius asmens duomenis tvarkome, kokiu tikslu ir kokiu ' +
    'teisiniu pagrindu tai darome, kam juos patikime ir kokiomis teisėmis galite ' +
    'pasinaudoti pagal Bendrąjį duomenų apsaugos reglamentą (BDAR). Svetainėje ' +
    'nėra mokėjimų, pristatymo, vidinių pokalbių ar reklamos tinklų, todėl ir ' +
    'tvarkomų duomenų apimtis yra sąmoningai maža.',
  sections: [
    {
      heading: 'Duomenų valdytojas ir kontaktai',
      paragraphs: [
        'Asmens duomenų valdytojas yra RATATAI — skelbimų lentos operatorius, ' +
          `veikiantis Vilniuje, Lietuvos Respublikoje. Susisiekti galite el. paštu ${CONTACT_EMAIL}.`,
        'Duomenų apsaugos pareigūnas nepaskirtas, nes tvarkymo pobūdis ir apimtis to ' +
          'nereikalauja. Visus su privatumu susijusius klausimus, prašymus ir ' +
          'pretenzijas nagrinėjame tuo pačiu el. pašto adresu.',
      ],
    },
    {
      heading: 'Kokius duomenis renkame',
      paragraphs: [
        'Registracijos metu surenkame el. pašto adresą ir slaptažodį. Slaptažodis ' +
          'saugomas tik kriptografinės santraukos pavidalu — nei mes, nei svetainės ' +
          'administratoriai jo nematome ir negalime atkurti.',
        'Profilyje galite nurodyti rodomą vardą, telefono numerį, miestą ir ' +
          'pageidaujamą svetainės kalbą. Visi šie laukai, išskyrus rodomą vardą, yra ' +
          'neprivalomi.',
        'Skelbiant kaupiamas paties skelbimo turinys: kategorija, techniniai ' +
          'parametrai, būklė, kaina, aprašymas ir įkeltos nuotraukos. Serverio ' +
          'žurnaluose trumpam lieka techniniai įrašai (IP adresas, užklausos laikas, ' +
          'naršyklės tipas), reikalingi svetainės saugumui ir klaidoms tirti.',
      ],
    },
    {
      heading: 'Tvarkymo tikslai ir teisiniai pagrindai',
      paragraphs: [
        'Paskyros sukūrimą, prisijungimą, skelbimų publikavimą ir jų valdymą ' +
          'tvarkome sutarties su jumis vykdymo pagrindu (BDAR 6 str. 1 d. b punktas). ' +
          'Be šių duomenų paskyra ir skelbimai techniškai neįmanomi.',
        'Svetainės saugumą, sukčiavimo ir piktnaudžiavimo prevenciją bei skelbimų ' +
          'moderavimą grindžiame teisėtu interesu (BDAR 6 str. 1 d. f punktas) ' +
          'užtikrinti, kad skelbimų lenta liktų saugi ir naudinga visiems ' +
          'naudotojams.',
        'Telefono numerio rodymą viešame skelbime tvarkome tik jūsų sutikimo ' +
          'pagrindu (BDAR 6 str. 1 d. a punktas). Sutikimą galite bet kada atšaukti ' +
          'profilio nustatymuose — numeris nedelsiant nustoja būti rodomas.',
      ],
    },
    {
      heading: 'Kokie duomenys matomi viešai',
      paragraphs: [
        'Viešai matomas skelbimo turinys, nuotraukos, jūsų rodomas vardas ir ' +
          'nurodytas miestas. Šią informaciją mato visi svetainės lankytojai ir ' +
          'paieškos sistemos.',
        'Telefono numeris rodomas tik tada, kai profilyje esate įjungę viešo numerio ' +
          'nustatymą. Net ir tokiu atveju numeris atskleidžiamas tik paspaudus ' +
          'mygtuką skelbimo puslapyje — taip apsunkiname automatinį numerių ' +
          'rinkimą.',
        'El. pašto adresas niekada nerodomas viešai ir neperduodamas kitiems ' +
          'naudotojams. Pirkėjai su pardavėjais susisiekia tiesiogiai telefonu, ' +
          'svetainėje nėra vidinės susirašinėjimo sistemos.',
      ],
    },
    {
      heading: 'Nuotraukos',
      paragraphs: [
        'Skelbimų nuotraukos saugomos „Supabase Storage“ failų saugykloje. Aktyvaus ' +
          'skelbimo nuotraukos pasiekiamos vieša nuoroda, kad jas galėtų rodyti ' +
          'naršyklė ir paieškos sistemos.',
        'Prašome nefotografuoti ir neįkelti pašalinių asmenų, dokumentų, valstybinio ' +
          'numerio ženklų ar kitų duomenų, kurių viešinti nenorite. Ištrynus skelbimą ' +
          'kartu pašalinamos ir jam priklausančios nuotraukos.',
      ],
    },
    {
      heading: 'Slapukai',
      paragraphs: [
        'Naudojame tik du slapukus: sesijos slapuką, be kurio neveiktų prisijungimas, ' +
          'ir kalbos slapuką, kuris įsimena pasirinktą svetainės kalbą. Abu yra ' +
          'techniškai būtini paprašytai paslaugai suteikti.',
        'Nenaudojame jokios lankomumo analitikos, reklamos tinklų, sekimo pikselių ar ' +
          'trečiųjų šalių profiliavimo įrankių. Būtiniesiems slapukams sutikimas ' +
          'neprivalomas, todėl svetainėje nematote sutikimo su slapukais lango.',
      ],
    },
    {
      heading: 'Duomenų saugojimo terminai',
      paragraphs: [
        'Paskyros ir profilio duomenis saugome tol, kol paskyra egzistuoja. Ištrynus ' +
          'paskyrą, susiję duomenys pašalinami.',
        'Skelbimus galite redaguoti, paslėpti arba ištrinti bet kuriuo metu. ' +
          'Ištrintas skelbimas pašalinamas iš viešos prieigos kartu su nuotraukomis.',
        'Techniniai serverio žurnalai saugomi trumpai ir naudojami tik saugumo ' +
          'incidentams bei techninėms klaidoms tirti. Ilgiau duomenis saugome tik ' +
          'tada, kai to reikalauja teisės aktai arba pareikštas teisinis ' +
          'reikalavimas.',
      ],
    },
    {
      heading: 'Duomenų tvarkytojai ir perdavimas',
      paragraphs: [
        'Pasitelkiame „Supabase“ kaip duomenų bazės, naudotojų autentifikacijos ir ' +
          'failų saugyklos paslaugų teikėją bei svetainės prieglobos (hostingo) ' +
          'tiekėją. Šie paslaugų teikėjai veikia kaip duomenų tvarkytojai pagal ' +
          'sutartis, atitinkančias BDAR 28 straipsnio reikalavimus.',
        'Jei duomenys patenka už Europos ekonominės erdvės ribų, tai vyksta tik esant ' +
          'BDAR V skyriuje numatytoms apsaugos priemonėms, pavyzdžiui, Europos ' +
          'Komisijos patvirtintoms standartinėms sutarčių sąlygoms.',
        'Asmens duomenų neparduodame, nenuomojame ir neperduodame reklamos tinklams ' +
          'ar duomenų brokeriams. Duomenis atskleidžiame teisėsaugai tik tada, kai to ' +
          'reikalauja įstatymas arba teisėtas kompetentingos institucijos ' +
          'nurodymas.',
      ],
    },
    {
      heading: 'Automatizuotas sprendimų priėmimas',
      paragraphs: [
        'Nevykdome automatizuoto sprendimų priėmimo ar profiliavimo, kuris jums ' +
          'sukeltų teisines pasekmes arba panašiai reikšmingai jus paveiktų.',
        'Skelbimų moderavimo sprendimus priima žmogus. Jei manote, kad sprendimas ' +
          `neteisingas, parašykite ${CONTACT_EMAIL} — jį peržiūrėsime.`,
      ],
    },
    {
      heading: 'Jūsų teisės',
      paragraphs: [
        'Turite teisę susipažinti su savo duomenimis, reikalauti juos ištaisyti ar ' +
          'ištrinti, apriboti jų tvarkymą, gauti juos susistemintu, kompiuterio ' +
          'skaitomu formatu (duomenų perkeliamumas), taip pat nesutikti su tvarkymu, ' +
          'grindžiamu teisėtu interesu.',
        'Kai tvarkymas grindžiamas sutikimu, jį galite atšaukti bet kada; atšaukimas ' +
          'neturi įtakos iki jo atlikto tvarkymo teisėtumui. Prašymus siųskite ' +
          `${CONTACT_EMAIL} iš to paties el. pašto adreso, kuriuo registruota paskyra, ` +
          '— atsakome ne vėliau kaip per vieną mėnesį.',
        'Jei manote, kad jūsų duomenys tvarkomi neteisėtai, turite teisę pateikti ' +
          'skundą Valstybinei duomenų apsaugos inspekcijai (L. Sapiegos g. 17, ' +
          'Vilnius, vdai.lrv.lt). Prieš tai maloniai prašome kreiptis į mus — ' +
          'daugumą klausimų pavyksta išspręsti tiesiogiai.',
      ],
    },
    {
      heading: 'Paskyros ištrynimas',
      paragraphs: [
        'Paskyrą galite ištrinti bet kada parašę ' +
          `${CONTACT_EMAIL} iš savo registracijos el. pašto adreso. Prašymą įvykdome ` +
          'be nepagrįsto delsimo.',
        'Kartu su paskyra pašalinami profilio duomenys, visi skelbimai ir jų ' +
          'nuotraukos. Jei norite pašalinti tik dalį turinio, skelbimus galite ištrinti ' +
          'patys savo paskyros skiltyje, paskyros neuždarydami.',
      ],
    },
    {
      heading: 'Politikos pakeitimai',
      paragraphs: [
        'Šią politiką galime atnaujinti, pavyzdžiui, pasikeitus teisės aktams ar ' +
          'svetainės funkcijoms. Galiojanti redakcija visada skelbiama šiame ' +
          'puslapyje, o atnaujinimo data nurodyta jo viršuje.',
        'Apie esminius pakeitimus, keičiančius duomenų tvarkymo apimtį ar tikslus, ' +
          'informuosime registruotus naudotojus el. paštu prieš jiems įsigaliojant.',
      ],
    },
  ],
  lastUpdated: LAST_UPDATED,
};

const PRIVACY_RU: LegalDocument = {
  intro:
    'RATATAI — это доска объявлений с открытым исходным кодом, на которой частные ' +
    'лица и компании размещают объявления о продаже шин, дисков и колёс в сборе. ' +
    'Настоящая политика конфиденциальности объясняет, какие персональные данные мы ' +
    'обрабатываем, с какой целью и на каком правовом основании, кому их доверяем и ' +
    'какими правами вы располагаете согласно Общему регламенту по защите данных ' +
    '(GDPR). На сайте нет платежей, доставки, внутренних чатов и рекламных сетей, ' +
    'поэтому объём обрабатываемых данных намеренно невелик.',
  sections: [
    {
      heading: 'Контролёр данных и контакты',
      paragraphs: [
        'Контролёром персональных данных является RATATAI — оператор доски ' +
          `объявлений, работающий в Вильнюсе, Литовская Республика. Связаться с нами ` +
          `можно по адресу ${CONTACT_EMAIL}.`,
        'Специалист по защите данных не назначен, поскольку характер и объём ' +
          'обработки этого не требуют. Все вопросы, запросы и претензии, связанные с ' +
          'конфиденциальностью, рассматриваются по тому же адресу электронной почты.',
      ],
    },
    {
      heading: 'Какие данные мы собираем',
      paragraphs: [
        'При регистрации собираются адрес электронной почты и пароль. Пароль ' +
          'хранится только в виде криптографической свёртки — ни мы, ни ' +
          'администраторы сайта его не видим и восстановить не можем.',
        'В профиле вы можете указать отображаемое имя, номер телефона, город и ' +
          'предпочитаемый язык сайта. Все эти поля, кроме отображаемого имени, ' +
          'необязательны.',
        'При публикации сохраняется содержание самого объявления: категория, ' +
          'технические параметры, состояние, цена, описание и загруженные фотографии. ' +
          'В журналах сервера ненадолго остаются технические записи (IP-адрес, время ' +
          'запроса, тип браузера), необходимые для безопасности сайта и разбора ' +
          'ошибок.',
      ],
    },
    {
      heading: 'Цели обработки и правовые основания',
      paragraphs: [
        'Создание учётной записи, вход, публикацию объявлений и управление ими мы ' +
          'обрабатываем на основании исполнения договора с вами (ст. 6(1)(b) GDPR). ' +
          'Без этих данных учётная запись и объявления технически невозможны.',
        'Безопасность сайта, предотвращение мошенничества и злоупотреблений, а также ' +
          'модерация объявлений основаны на законном интересе (ст. 6(1)(f) GDPR) ' +
          'сохранить доску объявлений безопасной и полезной для всех пользователей.',
        'Показ номера телефона в публичном объявлении осуществляется только на ' +
          'основании вашего согласия (ст. 6(1)(a) GDPR). Согласие можно в любой ' +
          'момент отозвать в настройках профиля — номер немедленно перестаёт ' +
          'отображаться.',
      ],
    },
    {
      heading: 'Какие данные видны публично',
      paragraphs: [
        'Публично видны содержание объявления, фотографии, ваше отображаемое имя и ' +
          'указанный город. Эту информацию видят все посетители сайта и поисковые ' +
          'системы.',
        'Номер телефона показывается только тогда, когда в профиле включена настройка ' +
          'публичного номера. Даже в этом случае номер раскрывается лишь после нажатия ' +
          'кнопки на странице объявления — так мы затрудняем автоматический сбор ' +
          'номеров.',
        'Адрес электронной почты никогда не отображается публично и не передаётся ' +
          'другим пользователям. Покупатели связываются с продавцами напрямую по ' +
          'телефону, внутренней переписки на сайте нет.',
      ],
    },
    {
      heading: 'Фотографии',
      paragraphs: [
        'Фотографии объявлений хранятся в файловом хранилище Supabase Storage. ' +
          'Фотографии активного объявления доступны по публичной ссылке, чтобы их мог ' +
          'показать браузер и проиндексировать поисковые системы.',
        'Просим не фотографировать и не загружать посторонних людей, документы, ' +
          'государственные регистрационные знаки и другие данные, которые вы не хотите ' +
          'предавать огласке. При удалении объявления удаляются и принадлежащие ему ' +
          'фотографии.',
      ],
    },
    {
      heading: 'Файлы cookie',
      paragraphs: [
        'Мы используем только два файла cookie: сессионный, без которого не работал бы ' +
          'вход, и языковой, запоминающий выбранный язык сайта. Оба технически ' +
          'необходимы для предоставления запрошенной услуги.',
        'Мы не используем аналитику посещаемости, рекламные сети, пиксели отслеживания ' +
          'и сторонние инструменты профилирования. Для необходимых cookie согласие не ' +
          'требуется, поэтому на сайте нет окна согласия на cookie.',
      ],
    },
    {
      heading: 'Сроки хранения данных',
      paragraphs: [
        'Данные учётной записи и профиля хранятся, пока существует учётная запись. ' +
          'После её удаления связанные данные стираются.',
        'Объявления можно редактировать, скрывать или удалять в любой момент. ' +
          'Удалённое объявление убирается из публичного доступа вместе с ' +
          'фотографиями.',
        'Технические журналы сервера хранятся недолго и используются только для ' +
          'расследования инцидентов безопасности и технических сбоев. Дольше данные ' +
          'сохраняются лишь тогда, когда этого требует закон или заявленное правовое ' +
          'требование.',
      ],
    },
    {
      heading: 'Обработчики данных и передача',
      paragraphs: [
        'Мы привлекаем Supabase как поставщика базы данных, аутентификации ' +
          'пользователей и файлового хранилища, а также поставщика хостинга сайта. Эти ' +
          'поставщики выступают обработчиками данных по договорам, отвечающим ' +
          'требованиям статьи 28 GDPR.',
        'Если данные попадают за пределы Европейской экономической зоны, это ' +
          'происходит только при наличии мер защиты, предусмотренных главой V GDPR, ' +
          'например стандартных договорных условий, утверждённых Европейской ' +
          'комиссией.',
        'Мы не продаём, не сдаём в аренду и не передаём персональные данные рекламным ' +
          'сетям или брокерам данных. Правоохранительным органам данные раскрываются ' +
          'только тогда, когда этого требует закон или законное предписание ' +
          'компетентного органа.',
      ],
    },
    {
      heading: 'Автоматизированное принятие решений',
      paragraphs: [
        'Мы не осуществляем автоматизированного принятия решений или профилирования, ' +
          'которое порождало бы для вас юридические последствия или иным образом ' +
          'существенно на вас влияло.',
        'Решения о модерации объявлений принимает человек. Если вы считаете решение ' +
          `ошибочным, напишите на ${CONTACT_EMAIL} — мы его пересмотрим.`,
      ],
    },
    {
      heading: 'Ваши права',
      paragraphs: [
        'Вы вправе получить доступ к своим данным, требовать их исправления или ' +
          'удаления, ограничить обработку, получить данные в структурированном, ' +
          'машиночитаемом формате (переносимость данных), а также возражать против ' +
          'обработки, основанной на законном интересе.',
        'Если обработка основана на согласии, его можно отозвать в любой момент; отзыв ' +
          'не влияет на законность обработки, совершённой до него. Запросы направляйте ' +
          `на ${CONTACT_EMAIL} с того же адреса, на который зарегистрирована учётная ` +
          'запись, — мы отвечаем не позднее чем в течение одного месяца.',
        'Если вы считаете, что ваши данные обрабатываются неправомерно, вы вправе ' +
          'подать жалобу в Государственную инспекцию по защите данных (Valstybinė ' +
          'duomenų apsaugos inspekcija, ул. Л. Сапегос 17, Вильнюс, vdai.lrv.lt). ' +
          'Просим сначала обратиться к нам — большинство вопросов удаётся решить ' +
          'напрямую.',
      ],
    },
    {
      heading: 'Удаление учётной записи',
      paragraphs: [
        'Учётную запись можно удалить в любой момент, написав на ' +
          `${CONTACT_EMAIL} с адреса электронной почты, использованного при ` +
          'регистрации. Запрос исполняется без необоснованной задержки.',
        'Вместе с учётной записью удаляются данные профиля, все объявления и их ' +
          'фотографии. Если вы хотите удалить только часть содержимого, объявления ' +
          'можно удалить самостоятельно в разделе своей учётной записи, не закрывая её.',
      ],
    },
    {
      heading: 'Изменения политики',
      paragraphs: [
        'Мы можем обновлять настоящую политику, например при изменении ' +
          'законодательства или функций сайта. Действующая редакция всегда публикуется ' +
          'на этой странице, а дата обновления указана вверху.',
        'О существенных изменениях, затрагивающих объём или цели обработки данных, мы ' +
          'сообщим зарегистрированным пользователям по электронной почте до их ' +
          'вступления в силу.',
      ],
    },
  ],
  lastUpdated: LAST_UPDATED,
};

const PRIVACY_EN: LegalDocument = {
  intro:
    'RATATAI is an open-source classifieds board where private individuals and ' +
    'businesses list tyres, rims and complete wheels for sale. This privacy policy ' +
    'explains what personal data we process, for what purpose and on what legal ' +
    'basis, who we entrust it to, and what rights you have under the General Data ' +
    'Protection Regulation (GDPR). The site has no payments, no delivery, no ' +
    'internal messaging and no advertising networks, so the amount of data we ' +
    'process is deliberately small.',
  sections: [
    {
      heading: 'Data controller and contact',
      paragraphs: [
        'The controller of personal data is RATATAI, the operator of this ' +
          'classifieds board, based in Vilnius, Republic of Lithuania. You can reach ' +
          `us at ${CONTACT_EMAIL}.`,
        'No data protection officer has been appointed, because the nature and scope ' +
          'of the processing do not require one. All privacy-related questions, ' +
          'requests and complaints are handled at the same email address.',
      ],
    },
    {
      heading: 'What data we collect',
      paragraphs: [
        'When you register we collect your email address and a password. The ' +
          'password is stored only as a cryptographic hash — neither we nor the site ' +
          'administrators can see or recover it.',
        'In your profile you may provide a display name, a phone number, a city and ' +
          'your preferred site language. All of these fields except the display name ' +
          'are optional.',
        'When you publish, we store the listing itself: category, technical ' +
          'specifications, condition, price, description and uploaded photos. Server ' +
          'logs briefly retain technical records (IP address, request time, browser ' +
          'type) needed for site security and error investigation.',
      ],
    },
    {
      heading: 'Purposes and legal bases',
      paragraphs: [
        'Account creation, sign-in, publishing listings and managing them are ' +
          'processed to perform our contract with you (Article 6(1)(b) GDPR). Without ' +
          'this data an account and listings are technically impossible.',
        'Site security, fraud and abuse prevention, and listing moderation rest on ' +
          'our legitimate interest (Article 6(1)(f) GDPR) in keeping the board safe ' +
          'and useful for every user.',
        'Showing a phone number on a public listing is based solely on your consent ' +
          '(Article 6(1)(a) GDPR). You can withdraw that consent at any time in your ' +
          'profile settings, and the number stops being shown immediately.',
      ],
    },
    {
      heading: 'What is shown publicly',
      paragraphs: [
        'The listing content, photos, your display name and the city you entered are ' +
          'publicly visible. This information is seen by every visitor and by search ' +
          'engines.',
        'A phone number is shown only if you have enabled the public number setting ' +
          'in your profile. Even then the number is revealed only after a click on ' +
          'the listing page, which makes bulk harvesting of numbers harder.',
        'Email addresses are never shown publicly and are never passed to other ' +
          'users. Buyers contact sellers directly by phone; the site has no internal ' +
          'messaging system.',
      ],
    },
    {
      heading: 'Photos',
      paragraphs: [
        'Listing photos are stored in Supabase Storage. Photos belonging to an ' +
          'active listing are reachable through a public link so that browsers can ' +
          'display them and search engines can index them.',
        'Please do not photograph or upload other people, documents, licence plates ' +
          'or any other information you would not want made public. Deleting a ' +
          'listing also deletes the photos that belong to it.',
      ],
    },
    {
      heading: 'Cookies',
      paragraphs: [
        'We use exactly two cookies: a session cookie, without which sign-in would ' +
          'not work, and a language cookie that remembers the site language you ' +
          'chose. Both are strictly necessary to provide the service you asked for.',
        'We use no visitor analytics, no advertising networks, no tracking pixels and ' +
          'no third-party profiling tools. Strictly necessary cookies do not require ' +
          'consent, which is why the site shows no cookie consent banner.',
      ],
    },
    {
      heading: 'Retention periods',
      paragraphs: [
        'Account and profile data are kept for as long as the account exists. Once ' +
          'the account is deleted, the associated data is removed.',
        'You can edit, hide or delete your listings at any time. A deleted listing is ' +
          'removed from public access together with its photos.',
        'Technical server logs are kept briefly and used only to investigate security ' +
          'incidents and technical faults. We keep data longer only where the law ' +
          'requires it or where a legal claim has been raised.',
      ],
    },
    {
      heading: 'Processors and transfers',
      paragraphs: [
        'We use Supabase as our database, user authentication and file storage ' +
          'provider, and a hosting provider to run the site. These providers act as ' +
          'processors under contracts that meet the requirements of Article 28 GDPR.',
        'Where data reaches a country outside the European Economic Area, it does so ' +
          'only under the safeguards set out in Chapter V GDPR, such as the standard ' +
          'contractual clauses approved by the European Commission.',
        'We do not sell, rent or share personal data with advertising networks or ' +
          'data brokers. We disclose data to law enforcement only where the law or a ' +
          'lawful order from a competent authority requires it.',
      ],
    },
    {
      heading: 'Automated decision-making',
      paragraphs: [
        'We carry out no automated decision-making or profiling that would produce ' +
          'legal effects concerning you or similarly significantly affect you.',
        'Moderation decisions are made by a human. If you believe a decision is ' +
          `wrong, write to ${CONTACT_EMAIL} and we will review it.`,
      ],
    },
    {
      heading: 'Your rights',
      paragraphs: [
        'You have the right to access your data, to have it rectified or erased, to ' +
          'restrict its processing, to receive it in a structured, machine-readable ' +
          'format (data portability), and to object to processing based on legitimate ' +
          'interest.',
        'Where processing is based on consent, you may withdraw it at any time; ' +
          'withdrawal does not affect the lawfulness of processing carried out before ' +
          `it. Send requests to ${CONTACT_EMAIL} from the email address your account ` +
          'is registered with, and we will reply within one month at the latest.',
        'If you believe your data is being processed unlawfully, you have the right ' +
          'to lodge a complaint with the Lithuanian State Data Protection Inspectorate ' +
          '(Valstybinė duomenų apsaugos inspekcija, L. Sapiegos g. 17, Vilnius, ' +
          'vdai.lrv.lt). We would ask you to contact us first — most matters can be ' +
          'resolved directly.',
      ],
    },
    {
      heading: 'Deleting your account',
      paragraphs: [
        `You can delete your account at any time by writing to ${CONTACT_EMAIL} from ` +
          'the email address used to register. We action such requests without undue ' +
          'delay.',
        'Deleting the account removes your profile data, all of your listings and ' +
          'their photos. If you only want to remove part of your content, you can ' +
          'delete individual listings in your account area without closing the ' +
          'account.',
      ],
    },
    {
      heading: 'Changes to this policy',
      paragraphs: [
        'We may update this policy, for example when the law or the features of the ' +
          'site change. The version in force is always published on this page, and ' +
          'the date it was updated is shown at the top.',
        'We will notify registered users by email before any substantial change to ' +
          'the scope or purposes of data processing takes effect.',
      ],
    },
  ],
  lastUpdated: LAST_UPDATED,
};

export const PRIVACY_POLICY: Readonly<Record<Locale, LegalDocument>> = {
  lt: PRIVACY_LT,
  ru: PRIVACY_RU,
  en: PRIVACY_EN,
};

/* -------------------------------------------------------------------------- */
/* Terms of use                                                               */
/* -------------------------------------------------------------------------- */

const TERMS_LT: LegalDocument = {
  intro:
    'Šios naudojimosi taisyklės nustato, kaip veikia RATATAI skelbimų lenta ir ko ' +
    'tikimės iš jos naudotojų. Kurdami paskyrą, skelbdami skelbimą arba tiesiog ' +
    'naršydami svetainėje patvirtinate, kad su taisyklėmis susipažinote ir ' +
    'įsipareigojate jų laikytis. Jei su jomis nesutinkate, svetaine naudotis ' +
    'negalite.',
  sections: [
    {
      heading: 'Kas yra RATATAI',
      paragraphs: [
        'RATATAI yra skelbimų lenta, skirta padangoms, ratlankiams ir ' +
          'komplektiniams ratams. Skelbimus rengia ir publikuoja patys naudotojai; ' +
          'platforma tik suteikia vietą skelbimui ir įrankius jam surasti.',
        'RATATAI nėra jokio sandorio šalis. Nepriimame ir netarpininkaujame ' +
          'mokėjimų, nesaugome lėšų, neorganizuojame pristatymo, netikriname prekių ' +
          'kokybės, kilmės ar techninės būklės ir nenustatome kainų. Pirkimo–pardavimo ' +
          'sutartis sudaroma tiesiogiai tarp pirkėjo ir pardavėjo, o visi su ja ' +
          'susiję klausimai sprendžiami tarpusavyje.',
        'Naudojimasis svetaine yra nemokamas. Svetainėje nėra vidinės susirašinėjimo ' +
          'sistemos — pirkėjai su pardavėjais susisiekia telefonu.',
      ],
    },
    {
      heading: 'Paskyra ir prisijungimo duomenys',
      paragraphs: [
        'Skelbti gali tik registruoti naudotojai. Paskyrą gali susikurti veiksnus ' +
          'fizinis asmuo arba juridinio asmens įgaliotas atstovas, nurodydamas ' +
          'galiojantį el. pašto adresą.',
        'Jūs atsakote už savo slaptažodžio saugumą ir už visus veiksmus, atliktus ' +
          'prisijungus prie jūsų paskyros. Slaptažodžio niekam neatskleiskite ir ' +
          'nenaudokite to paties slaptažodžio kitose svetainėse. Įtarę neteisėtą ' +
          `prieigą, nedelsdami pakeiskite slaptažodį ir praneškite ${CONTACT_EMAIL}.`,
        'Profilyje pateikiami duomenys turi būti teisingi ir palaikomi aktualūs. ' +
          'Viena paskyra skirta vienam asmeniui ar įmonei; kurti kelias paskyras ' +
          'siekiant apeiti apribojimus draudžiama.',
      ],
    },
    {
      heading: 'Skelbimų turinio reikalavimai',
      paragraphs: [
        'Skelbime privalote tiksliai nurodyti techninius parametrus: matmenis, ' +
          'apkrovos ir greičio indeksus, sezoną, protektoriaus gylį, gamybos savaitę, ' +
          'ratlankio skersmenį, plotį, PCD, ET ir centrinės skylės dydį — tiek, kiek ' +
          'tai taikoma parduodamai prekei.',
        'Nuotraukos turi būti tikros ir būtent to daikto, kuris parduodamas. ' +
          'Gamintojų katalogų, internete rastos ar kitų pardavėjų nuotraukos ' +
          'neleidžiamos. Matomi defektai — įtrūkiai, deformacijos, remonto žymės, ' +
          'netolygus dėvėjimasis — turi būti aiškiai nurodyti ir nuotraukose, ir ' +
          'aprašyme.',
        'Kaina turi būti reali ir nurodyta eurais. Vienas skelbimas skirtas vienai ' +
          'prekei arba vienam komplektui; to paties daikto kartoti keliuose ' +
          'skelbimuose negalima.',
      ],
    },
    {
      heading: 'Draudžiamas turinys ir prekės',
      paragraphs: [
        'Draudžiama skelbti padirbtas, vogtas ar kitaip neteisėtai įgytas prekes, ' +
          'taip pat prekes, kurių apyvarta ribojama arba uždrausta teisės aktais.',
        'Draudžiami skelbimai, nesusiję su padangomis, ratlankiais ar komplektiniais ' +
          'ratais, taip pat paslaugų reklama, nuorodos į kitas prekyvietes ar ' +
          'parduotuves, dubliuoti skelbimai ir masinis to paties turinio kėlimas.',
        'Draudžiama kontaktinius duomenis slėpti skelbimo tekste, pavadinime ar ' +
          'nuotraukose siekiant apeiti platformos kontaktų tvarką. Taip pat ' +
          'draudžiamas įžeidžiantis, diskriminuojantis turinys ir svetimų asmens ' +
          'duomenų skelbimas be sutikimo.',
      ],
    },
    {
      heading: 'Pardavėjo atsakomybė',
      paragraphs: [
        'Pardavėjas atsako už skelbimo teisėtumą, turinio tikslumą, teisę parduoti ' +
          'daiktą ir už tai, kad prekė atitiktų aprašymą. Pardavėjas taip pat pats ' +
          'tvarko savo mokestines ir kitas su prekyba susijusias prievoles.',
        'RATATAI netikrina prekių, nevertina jų kokybės ir neteikia jokių garantijų ' +
          'dėl skelbimų teisingumo. Skelbimo paskelbimas nereiškia, kad platforma jį ' +
          'patvirtino ar rekomenduoja.',
      ],
    },
    {
      heading: 'Turinio teisės ir licencija',
      paragraphs: [
        'Visos teisės į jūsų įkeltas nuotraukas ir parašytus tekstus lieka jums. ' +
          'Mes jų nenusavinam ir neperleidžiam tretiesiems asmenims.',
        'Paskelbdami skelbimą suteikiate RATATAI neatlygintiną, neišimtinę, ' +
          'teritorija neribotą licenciją saugoti šį turinį, keisti jo formatą bei ' +
          'dydį techninėms reikmėms ir rodyti jį svetainėje, jos paieškos ' +
          'rezultatuose bei skelbimo peržiūros kortelėse. Licencija reikalinga tik ' +
          'tam, kad skelbimas apskritai galėtų būti rodomas.',
        'Licencija pasibaigia ištrynus turinį, išskyrus technines atsargines kopijas, ' +
          'kurios pašalinamos įprastu jų atnaujinimo ciklu. Įkeldami turinį ' +
          'patvirtinate turintys visas reikalingas teises į jį.',
      ],
    },
    {
      heading: 'Moderavimas ir skelbimų šalinimas',
      paragraphs: [
        'Turime teisę redaguoti kategorijas, paslėpti arba pašalinti taisyklių ' +
          'neatitinkančius skelbimus, o esant pakartotiniams ar šiurkštiems ' +
          'pažeidimams — apriboti arba uždaryti paskyrą. Skubiais atvejais tai galime ' +
          'padaryti be išankstinio įspėjimo.',
        'Apie netinkamą skelbimą ar įtariamą sukčiavimą praneškite ' +
          `${CONTACT_EMAIL}. Tuo pačiu adresu galite ginčyti mūsų sprendimą — jį ` +
          'peržiūrėsime ir atsakysime.',
      ],
    },
    {
      heading: 'Garantijų ir atsakomybės ribojimas',
      paragraphs: [
        'Svetainė teikiama tokia, kokia yra. Negarantuojame, kad ji veiks be ' +
          'pertrūkių ar klaidų, kad skelbimų informacija bus teisinga ir kad prekė ' +
          'atitiks pirkėjo lūkesčius. Dėl techninės priežiūros ar atnaujinimų ' +
          'svetainės veikimas gali būti laikinai sustabdytas.',
        'Kiek tai leidžia Lietuvos Respublikos teisė, neatsakome už nuostolius, ' +
          'kylančius iš naudotojų tarpusavio sandorių, netikslių ar klaidinančių ' +
          'skelbimų, negautų pajamų, prarasto turinio ar trečiųjų šalių paslaugų ' +
          'sutrikimų.',
        'Šie ribojimai netaikomi žalai, padarytai tyčia ar dėl didelio neatsargumo, ' +
          'žalai gyvybei ar sveikatai, taip pat visais kitais atvejais, kai ' +
          'atsakomybės ribojimą draudžia imperatyvios teisės normos.',
      ],
    },
    {
      heading: 'Vartotojų teisės',
      paragraphs: [
        'Kai pardavėjas yra verslininkas, o pirkėjas — vartotojas, sandoriui taikomos ' +
          'Lietuvos Respublikos civilinio kodekso ir vartotojų teisių apsaugos teisės ' +
          'aktų nuostatos, įskaitant kokybės garantiją ir teisę atsisakyti nuotoliniu ' +
          'būdu sudarytos sutarties. Šios taisyklės tokių teisių neriboja ir nepanaikina.',
        'Verslininkai, skelbdami prekes, privalo aiškiai nurodyti savo statusą, kad ' +
          'pirkėjas žinotų, kokios teisės jam priklauso.',
      ],
    },
    {
      heading: 'Saugaus pirkimo ir pardavimo patarimai',
      paragraphs: [
        'Prieš mokėdami apžiūrėkite prekę gyvai: patikrinkite padangos DOT ženklinimą ' +
          'ir gamybos datą, protektoriaus gylį, šonų būklę, o ratlankio — geometriją, ' +
          'suvirinimo ar tiesinimo žymes ir tvirtinimo parametrų atitiktį jūsų ' +
          'automobiliui.',
        'Nesiųskite avanso, „rezervavimo mokesčio“ ar užstato nepažįstamiems asmenims ' +
          'ir nepersiųskite asmens dokumentų kopijų. Susitikite viešoje vietoje, ' +
          'atsiskaitykite tik gavę prekę.',
        'Įtarę sukčiavimą, nutraukite bendravimą, praneškite policijai ir ' +
          `parašykite mums ${CONTACT_EMAIL}.`,
      ],
    },
    {
      heading: 'Taikoma teisė ir ginčų sprendimas',
      paragraphs: [
        'Šioms taisyklėms ir santykiams tarp naudotojo ir RATATAI taikoma Lietuvos ' +
          'Respublikos teisė. Ginčai sprendžiami Lietuvos Respublikos teismuose, ' +
          'jeigu imperatyvios teisės normos nenustato kitaip.',
        'Ginčus visų pirma siekiame išspręsti derybomis. Vartotojai taip pat gali ' +
          'kreiptis į Valstybinę vartotojų teisių apsaugos tarnybą arba pasinaudoti ' +
          'Europos Komisijos elektronine ginčų sprendimo platforma.',
      ],
    },
    {
      heading: 'Taisyklių pakeitimai ir kontaktai',
      paragraphs: [
        'Taisykles galime keisti tobulindami svetainę arba pasikeitus teisės aktams. ' +
          'Galiojanti redakcija visada skelbiama šiame puslapyje, o jos atnaujinimo ' +
          'data nurodyta viršuje. Toliau naudodamiesi svetaine po pakeitimų ' +
          'įsigaliojimo patvirtinate, kad su jais sutinkate.',
        `Visais klausimais dėl taisyklių rašykite ${CONTACT_EMAIL}. RATATAI yra ` +
          'atviro kodo projektas, todėl pastabos ir pasiūlymai dėl taisyklių aiškumo ' +
          'yra laukiami.',
      ],
    },
  ],
  lastUpdated: LAST_UPDATED,
};

const TERMS_RU: LegalDocument = {
  intro:
    'Настоящие правила пользования определяют, как работает доска объявлений RATATAI ' +
    'и чего мы ждём от её пользователей. Создавая учётную запись, публикуя ' +
    'объявление или просто просматривая сайт, вы подтверждаете, что ознакомились с ' +
    'правилами и обязуетесь их соблюдать. Если вы с ними не согласны, пользоваться ' +
    'сайтом нельзя.',
  sections: [
    {
      heading: 'Что такое RATATAI',
      paragraphs: [
        'RATATAI — доска объявлений для шин, дисков и колёс в сборе. Объявления ' +
          'составляют и публикуют сами пользователи; платформа лишь предоставляет ' +
          'место для объявления и инструменты для его поиска.',
        'RATATAI не является стороной какой-либо сделки. Мы не принимаем платежи и не ' +
          'выступаем посредником в них, не храним денежные средства, не организуем ' +
          'доставку, не проверяем качество, происхождение и техническое состояние ' +
          'товара и не устанавливаем цены. Договор купли-продажи заключается напрямую ' +
          'между покупателем и продавцом, и все связанные с ним вопросы решаются между ' +
          'ними.',
        'Пользование сайтом бесплатно. Внутренней переписки на сайте нет — покупатели ' +
          'связываются с продавцами по телефону.',
      ],
    },
    {
      heading: 'Учётная запись и данные для входа',
      paragraphs: [
        'Публиковать объявления могут только зарегистрированные пользователи. Учётную ' +
          'запись может создать дееспособное физическое лицо или уполномоченный ' +
          'представитель юридического лица, указав действующий адрес электронной ' +
          'почты.',
        'Вы отвечаете за сохранность своего пароля и за все действия, совершённые под ' +
          'вашей учётной записью. Никому не сообщайте пароль и не используйте тот же ' +
          'пароль на других сайтах. Заподозрив несанкционированный доступ, немедленно ' +
          `смените пароль и сообщите на ${CONTACT_EMAIL}.`,
        'Указанные в профиле данные должны быть достоверными и поддерживаться в ' +
          'актуальном состоянии. Одна учётная запись предназначена для одного лица или ' +
          'компании; создание нескольких учётных записей в обход ограничений ' +
          'запрещено.',
      ],
    },
    {
      heading: 'Требования к содержанию объявлений',
      paragraphs: [
        'В объявлении необходимо точно указать технические параметры: размеры, индексы ' +
          'нагрузки и скорости, сезонность, глубину протектора, неделю производства, ' +
          'диаметр и ширину диска, PCD, вылет ET и размер центрального отверстия — в ' +
          'той мере, в какой это применимо к продаваемому товару.',
        'Фотографии должны быть настоящими и именно того предмета, который продаётся. ' +
          'Снимки из каталогов производителей, найденные в интернете или взятые у ' +
          'других продавцов, не допускаются. Видимые дефекты — трещины, деформации, ' +
          'следы ремонта, неравномерный износ — должны быть ясно показаны на ' +
          'фотографиях и описаны в тексте.',
        'Цена должна быть реальной и указываться в евро. Одно объявление — один товар ' +
          'или один комплект; повторять тот же предмет в нескольких объявлениях ' +
          'нельзя.',
      ],
    },
    {
      heading: 'Запрещённые содержание и товары',
      paragraphs: [
        'Запрещено размещать поддельные, краденые или иным образом незаконно ' +
          'полученные товары, а также товары, оборот которых ограничен или запрещён ' +
          'законом.',
        'Запрещены объявления, не относящиеся к шинам, дискам или колёсам в сборе, а ' +
          'также реклама услуг, ссылки на другие торговые площадки и магазины, ' +
          'дублирующие объявления и массовая загрузка одного и того же содержания.',
        'Запрещено прятать контактные данные в тексте объявления, в заголовке или на ' +
          'фотографиях, чтобы обойти принятый на платформе порядок контактов. Также ' +
          'запрещены оскорбительные и дискриминационные материалы и публикация ' +
          'персональных данных других лиц без их согласия.',
      ],
    },
    {
      heading: 'Ответственность продавца',
      paragraphs: [
        'Продавец отвечает за правомерность объявления, точность его содержания, ' +
          'право продавать вещь и за соответствие товара описанию. Продавец также ' +
          'самостоятельно исполняет свои налоговые и иные связанные с торговлей ' +
          'обязанности.',
        'RATATAI не проверяет товары, не оценивает их качество и не даёт никаких ' +
          'гарантий относительно достоверности объявлений. Публикация объявления не ' +
          'означает, что платформа его одобрила или рекомендует.',
      ],
    },
    {
      heading: 'Права на содержание и лицензия',
      paragraphs: [
        'Все права на загруженные вами фотографии и написанные тексты остаются за ' +
          'вами. Мы их не присваиваем и не передаём третьим лицам.',
        'Публикуя объявление, вы предоставляете RATATAI безвозмездную, ' +
          'неисключительную, не ограниченную территорией лицензию хранить это ' +
          'содержание, изменять его формат и размер для технических нужд и показывать ' +
          'его на сайте, в результатах поиска и в карточках предпросмотра объявления. ' +
          'Лицензия нужна лишь для того, чтобы объявление вообще могло отображаться.',
        'Лицензия прекращается после удаления содержания, за исключением технических ' +
          'резервных копий, которые удаляются в обычном цикле их обновления. Загружая ' +
          'материалы, вы подтверждаете, что обладаете всеми необходимыми правами на ' +
          'них.',
      ],
    },
    {
      heading: 'Модерация и удаление объявлений',
      paragraphs: [
        'Мы вправе изменять категории, скрывать или удалять объявления, не ' +
          'соответствующие правилам, а при повторных или грубых нарушениях — ограничить ' +
          'или закрыть учётную запись. В неотложных случаях это может быть сделано без ' +
          'предварительного предупреждения.',
        'О неподобающем объявлении или подозрении на мошенничество сообщайте на ' +
          `${CONTACT_EMAIL}. По тому же адресу можно оспорить наше решение — мы его ` +
          'пересмотрим и ответим.',
      ],
    },
    {
      heading: 'Ограничение гарантий и ответственности',
      paragraphs: [
        'Сайт предоставляется «как есть». Мы не гарантируем, что он будет работать ' +
          'без перерывов и ошибок, что сведения в объявлениях окажутся верными и что ' +
          'товар оправдает ожидания покупателя. Из-за технического обслуживания или ' +
          'обновлений работа сайта может быть временно приостановлена.',
        'В пределах, допускаемых правом Литовской Республики, мы не отвечаем за убытки, ' +
          'возникшие из сделок между пользователями, неточных или вводящих в ' +
          'заблуждение объявлений, упущенной выгоды, утраты содержания или сбоев в ' +
          'услугах третьих лиц.',
        'Эти ограничения не применяются к вреду, причинённому умышленно или по грубой ' +
          'неосторожности, к вреду жизни и здоровью, а также во всех иных случаях, ' +
          'когда ограничение ответственности запрещено императивными нормами права.',
      ],
    },
    {
      heading: 'Права потребителей',
      paragraphs: [
        'Если продавец является предпринимателем, а покупатель — потребителем, к сделке ' +
          'применяются нормы Гражданского кодекса Литовской Республики и ' +
          'законодательства о защите прав потребителей, включая гарантию качества и ' +
          'право отказаться от договора, заключённого дистанционно. Настоящие правила ' +
          'таких прав не ограничивают и не отменяют.',
        'Предприниматели при размещении товаров обязаны ясно указывать свой статус, ' +
          'чтобы покупатель знал, какие права ему принадлежат.',
      ],
    },
    {
      heading: 'Советы по безопасной покупке и продаже',
      paragraphs: [
        'Перед оплатой осмотрите товар лично: проверьте маркировку DOT и дату ' +
          'производства шины, глубину протектора, состояние боковин, а у диска — ' +
          'геометрию, следы сварки или правки и соответствие крепёжных параметров ' +
          'вашему автомобилю.',
        'Не отправляйте предоплату, «плату за бронирование» или задаток незнакомым ' +
          'людям и не пересылайте копии документов. Встречайтесь в общественном месте ' +
          'и рассчитывайтесь только после получения товара.',
        'Заподозрив мошенничество, прекратите общение, сообщите в полицию и напишите ' +
          `нам на ${CONTACT_EMAIL}.`,
      ],
    },
    {
      heading: 'Применимое право и разрешение споров',
      paragraphs: [
        'К настоящим правилам и отношениям между пользователем и RATATAI применяется ' +
          'право Литовской Республики. Споры разрешаются в судах Литовской Республики, ' +
          'если императивные нормы права не предусматривают иного.',
        'Мы стремимся прежде всего урегулировать споры переговорами. Потребители также ' +
          'могут обратиться в Государственную службу защиты прав потребителей или ' +
          'воспользоваться платформой электронного разрешения споров Европейской ' +
          'комиссии.',
      ],
    },
    {
      heading: 'Изменения правил и контакты',
      paragraphs: [
        'Мы можем изменять правила по мере развития сайта или при изменении ' +
          'законодательства. Действующая редакция всегда публикуется на этой странице, ' +
          'а дата её обновления указана вверху. Продолжая пользоваться сайтом после ' +
          'вступления изменений в силу, вы подтверждаете своё согласие с ними.',
        `По всем вопросам, связанным с правилами, пишите на ${CONTACT_EMAIL}. RATATAI — ` +
          'проект с открытым исходным кодом, поэтому замечания и предложения по ' +
          'ясности правил приветствуются.',
      ],
    },
  ],
  lastUpdated: LAST_UPDATED,
};

const TERMS_EN: LegalDocument = {
  intro:
    'These terms of use set out how the RATATAI classifieds board works and what we ' +
    'expect from the people who use it. By creating an account, publishing a ' +
    'listing or simply browsing the site you confirm that you have read these terms ' +
    'and agree to follow them. If you do not agree with them, you may not use the ' +
    'site.',
  sections: [
    {
      heading: 'What RATATAI is',
      paragraphs: [
        'RATATAI is a classifieds board for tyres, rims and complete wheels. Listings ' +
          'are written and published by users themselves; the platform only provides a ' +
          'place for the listing and the tools to find it.',
        'RATATAI is not a party to any transaction. We do not take or intermediate ' +
          'payments, hold funds, arrange delivery, verify the quality, origin or ' +
          'technical condition of goods, or set prices. The contract of sale is made ' +
          'directly between buyer and seller, and everything arising from it is ' +
          'settled between them.',
        'Using the site is free of charge. There is no internal messaging system — ' +
          'buyers contact sellers by phone.',
      ],
    },
    {
      heading: 'Accounts and credentials',
      paragraphs: [
        'Only registered users can publish listings. An account may be created by an ' +
          'individual with legal capacity or by an authorised representative of a ' +
          'company, using a valid email address.',
        'You are responsible for keeping your password safe and for everything done ' +
          'through your account. Do not share your password and do not reuse it on ' +
          'other sites. If you suspect unauthorised access, change your password ' +
          `immediately and tell us at ${CONTACT_EMAIL}.`,
        'The details in your profile must be accurate and kept up to date. One ' +
          'account is meant for one person or company; creating several accounts to ' +
          'get around restrictions is not allowed.',
      ],
    },
    {
      heading: 'Listing content requirements',
      paragraphs: [
        'A listing must state the technical specifications accurately: dimensions, ' +
          'load and speed indices, season, tread depth, production week, rim diameter ' +
          'and width, PCD, ET offset and centre bore — as far as these apply to the ' +
          'item being sold.',
        'Photos must be genuine and of the exact item for sale. Manufacturer catalogue ' +
          'images, pictures found online and photos taken from other sellers are not ' +
          'allowed. Visible defects — cracks, deformation, signs of repair, uneven ' +
          'wear — must be clearly shown in the photos and described in the text.',
        'The price must be realistic and given in euros. One listing covers one item ' +
          'or one set; the same item may not be repeated across several listings.',
      ],
    },
    {
      heading: 'Prohibited content and goods',
      paragraphs: [
        'It is prohibited to list counterfeit, stolen or otherwise unlawfully ' +
          'obtained goods, as well as goods whose sale is restricted or banned by law.',
        'Listings unrelated to tyres, rims or complete wheels are not allowed, and ' +
          'neither are service advertisements, links to other marketplaces or shops, ' +
          'duplicate listings and bulk uploads of the same content.',
        'Hiding contact details in the listing text, the title or the photos in order ' +
          'to circumvent the platform is prohibited. Offensive or discriminatory ' +
          'content and the publication of other people’s personal data without ' +
          'their consent are equally prohibited.',
      ],
    },
    {
      heading: 'Seller responsibility',
      paragraphs: [
        'The seller is responsible for the legality of the listing, the accuracy of ' +
          'its content, the right to sell the item and for the goods matching the ' +
          'description. The seller also handles their own tax and other trading ' +
          'obligations.',
        'RATATAI does not inspect goods, does not assess their quality and gives no ' +
          'warranty as to the accuracy of any listing. Publication of a listing does ' +
          'not mean the platform has approved or recommends it.',
      ],
    },
    {
      heading: 'Content ownership and licence',
      paragraphs: [
        'You keep all rights to the photos you upload and the text you write. We do ' +
          'not claim ownership of them and do not pass them to third parties.',
        'By publishing a listing you grant RATATAI a free, non-exclusive, ' +
          'territorially unlimited licence to store that content, change its format ' +
          'and size for technical purposes, and display it on the site, in its search ' +
          'results and in listing preview cards. The licence exists only so that the ' +
          'listing can be shown at all.',
        'The licence ends when you delete the content, except for technical backups, ' +
          'which are removed in their normal rotation. By uploading content you ' +
          'confirm that you hold all the rights needed for it.',
      ],
    },
    {
      heading: 'Moderation and removal',
      paragraphs: [
        'We may correct categories, hide or remove listings that breach these terms, ' +
          'and restrict or close an account in case of repeated or serious breaches. ' +
          'In urgent cases we may do so without prior warning.',
        `Report an inappropriate listing or suspected fraud to ${CONTACT_EMAIL}. You ` +
          'can challenge our decision at the same address — we will review it and ' +
          'reply.',
      ],
    },
    {
      heading: 'Disclaimer and limitation of liability',
      paragraphs: [
        'The site is provided as is. We do not warrant that it will run without ' +
          'interruption or errors, that the information in listings will be correct, ' +
          'or that an item will meet a buyer’s expectations. Maintenance and ' +
          'updates may temporarily suspend the service.',
        'To the extent permitted by the law of the Republic of Lithuania, we are not ' +
          'liable for losses arising from transactions between users, from inaccurate ' +
          'or misleading listings, from lost profit or lost content, or from failures ' +
          'of third-party services.',
        'These limitations do not apply to damage caused intentionally or through ' +
          'gross negligence, to damage to life or health, or in any other case where ' +
          'mandatory law prohibits limiting liability.',
      ],
    },
    {
      heading: 'Consumer rights',
      paragraphs: [
        'Where the seller is a trader and the buyer is a consumer, the transaction is ' +
          'governed by the Civil Code of the Republic of Lithuania and by consumer ' +
          'protection law, including the quality guarantee and the right to withdraw ' +
          'from a distance contract. These terms neither restrict nor remove those ' +
          'rights.',
        'Traders must clearly state their status when they publish a listing, so that ' +
          'buyers know which rights apply to them.',
      ],
    },
    {
      heading: 'Advice for safe buying and selling',
      paragraphs: [
        'Inspect the item in person before paying: check the tyre’s DOT marking ' +
          'and production date, the tread depth and the condition of the sidewalls; ' +
          'for a rim, check its geometry, any signs of welding or straightening, and ' +
          'whether the fitment matches your car.',
        'Do not send advance payments, "reservation fees" or deposits to strangers, ' +
          'and do not send copies of identity documents. Meet in a public place and ' +
          'pay only once you have the goods.',
        'If you suspect fraud, stop communicating, report it to the police and write ' +
          `to us at ${CONTACT_EMAIL}.`,
      ],
    },
    {
      heading: 'Governing law and disputes',
      paragraphs: [
        'These terms and the relationship between a user and RATATAI are governed by ' +
          'the law of the Republic of Lithuania. Disputes are resolved by the courts ' +
          'of the Republic of Lithuania, unless mandatory law provides otherwise.',
        'We aim to settle disputes through negotiation first. Consumers may also turn ' +
          'to the State Consumer Rights Protection Authority of Lithuania or use the ' +
          'European Commission online dispute resolution platform.',
      ],
    },
    {
      heading: 'Changes to these terms and contact',
      paragraphs: [
        'We may change these terms as the site develops or as the law changes. The ' +
          'version in force is always published on this page, with the date it was ' +
          'updated shown at the top. Continuing to use the site after a change takes ' +
          'effect means you accept it.',
        `For any question about these terms, write to ${CONTACT_EMAIL}. RATATAI is an ` +
          'open-source project, so remarks and suggestions on how to make these terms ' +
          'clearer are welcome.',
      ],
    },
  ],
  lastUpdated: LAST_UPDATED,
};

export const TERMS_OF_USE: Readonly<Record<Locale, LegalDocument>> = {
  lt: TERMS_LT,
  ru: TERMS_RU,
  en: TERMS_EN,
};
