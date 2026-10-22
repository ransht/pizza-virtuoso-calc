// Generates the static guide pages (yom-huledet/, mesibat-kita/, misrad/) and
// the quantity tables inside index.html. Every tray count is computed with
// calc.js, so the written guides can never drift from the calculator.
//
//   node build-guides.mjs
//
// The output is committed; content.test.js fails if it is stale.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calculatePizzas, YOUNG_CHILD_UNITS, CHILD_UNITS, TEEN_ADULT_UNITS, DEFAULT_SERVING_UNITS_PER_PIZZA } from "./calc.js";
import { CONFIG } from "./config.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const SITE = "https://calc.pizzavirtuoso.co.il";
const WHATSAPP = `https://wa.me/${CONFIG.quoteWhatsApp.localPhone.replace(/^0/, "972")}`;
const SLICES = DEFAULT_SERVING_UNITS_PER_PIZZA;

const trays = ({ y = 0, c = 0, t = 0, a = "normal" }) =>
  calculatePizzas({ youngChildren: y, children: c, teensAndAdults: t, appetite: a }).pizzas;

// A table cell that carries its own inputs, so content.test.js can re-check it.
const cell = (input) => {
  const { y = 0, c = 0, t = 0, a = "normal" } = input;
  return `<td data-calc="y=${y};c=${c};t=${t};a=${a}">${trays(input)}</td>`;
};

// Deep link that opens the calculator pre-filled (same format as "share plan").
const preset = ({ event, y = 0, c = 0, t = 0 }) =>
  `/#v=1&event=${event}&yc=${y}&c=${c + y}&t=${t}&appetite=normal&otherMeal=0&extra=0`;

const table = (caption, head, rows) => `
      <div class="examples-table-wrap">
        <table class="examples-table qty-table">
          <caption class="visually-hidden">${caption}</caption>
          <thead>
            <tr>${head.map((h) => `<th scope="col">${h}</th>`).join("")}</tr>
          </thead>
          <tbody>
${rows.map((r) => `            <tr>${r.join("")}</tr>`).join("\n")}
          </tbody>
        </table>
      </div>`;

const th = (text) => `<th scope="row">${text}</th>`;
const APPETITE_HEAD = ["תיאבון קל", "תיאבון רגיל", "תיאבון גדול"];
const byAppetite = (input) => ["light", "normal", "large"].map((a) => cell({ ...input, a }));

// ---------- guide content ----------

const GUIDES = [
  {
    slug: "yom-huledet",
    nav: "פיצה ליום הולדת",
    title: "כמה פיצות להזמין ליום הולדת? טבלת כמויות לפי מספר ילדים | פיצה וירטואוז",
    description: `כמה מגשי פיצה להזמין ליום הולדת: טבלאות ל-10 עד 40 ילדים, לגן, לבית ספר ולבר/בת מצווה, כולל הורים מלווים. ל-20 ילדים ו-4 מלווים צריך ${trays({ c: 20, t: 4 })} מגשים.`,
    kicker: "מדריך כמויות · יום הולדת",
    h1: "כמה פיצות להזמין ליום הולדת?",
    lead: `כלל האצבע: מגש אחד של ${SLICES} משולשים לכל ארבעה ילדים בגיל בית ספר, ועוד מגש לכל שניים–שלושה מבוגרים שנשארים לאכול. ל-20 ילדים ו-4 מלווים זה יוצא ${trays({ c: 20, t: 4 })} מגשים.`,
    preset: { event: "birthday", c: 20, t: 4 },
    quote: "היי, אני מתכנן/ת יום הולדת ורוצה הצעת מחיר למגשי פיצה",
    body: () => `
    <section class="info-section">
      <h2>טבלת כמויות ליום הולדת בגיל 7–12</h2>
      <p class="lead">ילד בגיל בית ספר אוכל בממוצע ${CHILD_UNITS} משולשים, ומבוגר ${TEEN_ADULT_UNITS}. הטבלה מניחה מלווה אחד לכל חמישה ילדים; אם מגיעים יותר הורים, הוסיפו אותם במחשבון.</p>
${table("מגשי פיצה ליום הולדת בגיל 7 עד 12", ["ילדים", "מלווים", "תיאבון רגיל", "רעבים במיוחד"],
      [10, 15, 20, 25, 30, 40].map((c) => [th(`${c} ילדים`), `<td>${c / 5}</td>`, cell({ c, t: c / 5 }), cell({ c, t: c / 5, a: "large" })]))}
    </section>

    <section class="info-section">
      <h2>יום הולדת בגן: גיל 3–6</h2>
      <p class="lead">ילדי גן אוכלים פחות, כמשולש וחצי בממוצע, ולרוב מגיעים עם הורה. לכן דווקא מספר המבוגרים קובע כאן הרבה מהכמות.</p>
${table("מגשי פיצה ליום הולדת בגן", ["ילדי גן", "מבוגרים", "מגשים"],
      [[10, 5], [15, 8], [20, 10], [25, 12], [30, 15]].map(([y, t]) => [th(`${y} ילדים`), `<td>${t}</td>`, cell({ y, t })]))}
    </section>

    <section class="info-section">
      <h2>איך מחשבים לבד, בשלושה צעדים</h2>
      <p class="lead">אין צורך בנוסחה מסובכת. זה החישוב שהמחשבון עושה, על דוגמה של 20 ילדים בכיתה ג' ו-4 הורים שנשארים.</p>
      <ol class="tips">
        <li><strong>סופרים משולשים.</strong> 20 ילדים כפול ${CHILD_UNITS} משולשים הם ${20 * CHILD_UNITS}, ו-4 מבוגרים כפול ${TEEN_ADULT_UNITS} הם ${4 * TEEN_ADULT_UNITS}. ביחד ${20 * CHILD_UNITS + 4 * TEEN_ADULT_UNITS} משולשים.</li>
        <li><strong>מחלקים במגש.</strong> ${20 * CHILD_UNITS + 4 * TEEN_ADULT_UNITS} משולשים חלקי ${SLICES} משולשים במגש הם ${((20 * CHILD_UNITS + 4 * TEEN_ADULT_UNITS) / SLICES).toFixed(1)} מגשים.</li>
        <li><strong>מעגלים למעלה.</strong> לא מזמינים חצי מגש, ולכן מזמינים ${trays({ c: 20, t: 4 })} מגשים.</li>
      </ol>
      <p>במסיבה בשעת ערב, או כשהילדים חוזרים רעבים מחוג, בחרו במחשבון תיאבון גדול. זה מוסיף בערך רבע לכמות.</p>
    </section>

    <section class="info-section">
      <h2>בר מצווה, בת מצווה ומסיבות נוער</h2>
      <p class="lead">מגיל 13 בני נוער אוכלים כמו מבוגרים, ${TEEN_ADULT_UNITS} משולשים בממוצע ולפעמים יותר. זו הקפיצה שהכי קל לפספס: כיתה ז' צריכה כמעט פי אחד וחצי פיצה מכיתה ה'.</p>
${table("מגשי פיצה למסיבת נוער ובר מצווה", ["בני נוער", ...APPETITE_HEAD],
      [15, 20, 30, 40, 50, 60].map((t) => [th(`${t} בני נוער`), ...byAppetite({ t })]))}
      <p>אם הפיצה מוגשת אחרי ארוחה מלאה, למשל במסיבת המשך בערב, בחרו תיאבון קל. אם היא הארוחה של הערב, בחרו רגיל או גדול.</p>
    </section>

    <section class="info-section">
      <h2>יום הולדת משפחתי: ילדים ומבוגרים יחד</h2>
      <p class="lead">בחגיגה משפחתית, עם סבים, דודים ובני דודים, המבוגרים הם רוב הכמות. הטבלה מראה כמה מגשים צריך לשילובים נפוצים.</p>
${table("מגשי פיצה ליום הולדת משפחתי", ["ילדים", "מבוגרים", "מגשים"],
      [[8, 6], [10, 10], [12, 15], [15, 20], [20, 25]].map(([c, t]) => [th(`${c} ילדים`), `<td>${t}</td>`, cell({ c, t })]))}
    </section>

    <section class="info-section">
      <h2>מה משנה את הכמות</h2>
      <ul class="tips">
        <li><strong>שעת האירוע.</strong> מסיבה בשעת ארוחת הערב דורשת את הכמות המלאה. אחר הצהריים, אחרי ארוחת צהריים, אפשר לבחור תיאבון קל.</li>
        <li><strong>כיבוד נוסף.</strong> חטיפים, פירות ועוגה לא מחליפים ארוחה ולא מורידים מכמות הפיצה. רק מנה משביעה נוספת, כמו פסטה, מפחיתה כ-15%.</li>
        <li><strong>הורים שנשארים.</strong> זו הטעות הנפוצה: סופרים רק את הילדים. כל מבוגר שנשאר אוכל כמו ילד וחצי.</li>
        <li><strong>אחים קטנים.</strong> אם מצטרפים אחים, ספרו גם אותם. במחשבון אפשר לסמן כמה מהילדים בגיל 3–6.</li>
      </ul>

      <h3>איזה טעמים להזמין</h3>
      <p>בימי הולדת הולכים על בטוח: כ-70% מרגריטה והשאר עם תוספת עדינה כמו זיתים או תירס. ל-7 מגשים זה יוצא 5 מרגריטה ו-2 זיתים. המחשבון מציע שלושה הרכבים מוכנים לכל כמות.</p>

      <h3>טיפים קטנים שחוסכים כאב ראש</h3>
      <ul class="tips">
        <li>בקשו לחתוך את המגשים ל-16 חלקים. זה לא מוסיף אוכל, אבל משולש קטן נוח לילדים ופחות נזרק.</li>
        <li>תאמו מראש את שעת האיסוף או המשלוח, כך שהפיצה תגיע חמה ולא לפני שהילדים התיישבו.</li>
        <li>לא בטוחים? במחשבון יש אפשרות להוסיף 10% רזרבה, במקום לנחש "עוד מגש ליתר ביטחון".</li>
      </ul>

      <h3>מתי להזמין ואיך לתזמן</h3>
      <ul class="tips">
        <li><strong>יום–יומיים מראש.</strong> הזמנה של כמה מגשים לשעה מדויקת עדיף לתאם מראש, במיוחד בסוף שבוע ובחגים.</li>
        <li><strong>הפיצה אחרי הפעילות.</strong> אם יש מפעיל או סדנה, תזמנו את הפיצה לסוף הפעילות. ילדים שאכלו בהתחלה פחות מתרכזים בהפעלה.</li>
        <li><strong>מספר סופי ערב לפני.</strong> עדכנו את הכמות לפי האישורים בפועל. ההבדל בין 18 ל-24 ילדים הוא כבר מגש וחצי.</li>
      </ul>
    </section>`,
    faq: [
      ["כמה פיצות להזמין ל-10 ילדים?", `ל-10 ילדים בגיל בית ספר צריך ${trays({ c: 10 })} מגשים בתיאבון רגיל. עם 2 הורים שנשארים, ${trays({ c: 10, t: 2 })} מגשים.`],
      ["כמה פיצות להזמין ל-15 ילדים?", `ל-15 ילדים צריך ${trays({ c: 15 })} מגשים בתיאבון רגיל, ו-${trays({ c: 15, t: 3 })} אם נשארים 3 מבוגרים.`],
      ["כמה פיצות להזמין ל-20 ילדים?", `ל-20 ילדים בגיל בית ספר צריך ${trays({ c: 20 })} מגשים בתיאבון רגיל. אם נשארים 4 מבוגרים מלווים, הכמות עולה ל-${trays({ c: 20, t: 4 })} מגשים.`],
      ["כמה פיצות להזמין ל-30 ילדים?", `ל-30 ילדים בגיל בית ספר צריך ${trays({ c: 30 })} מגשים בתיאבון רגיל, ו-${trays({ c: 30, t: 6 })} עם 6 מלווים.`],
      ["כמה פיצות להזמין ל-40 ילדים?", `ל-40 ילדים צריך ${trays({ c: 40 })} מגשים בתיאבון רגיל. עם 8 מלווים הכמות היא ${trays({ c: 40, t: 8 })} מגשים.`],
      ["כמה פיצות ליום הולדת בגן עם 20 ילדים?", `ל-20 ילדי גן ו-10 הורים צריך ${trays({ y: 20, t: 10 })} מגשים. ילדי גן אוכלים כ-${YOUNG_CHILD_UNITS} משולשים, וההורים הם חלק גדול מהכמות.`],
      ["כמה פיצות לבר מצווה או בת מצווה עם 50 בני נוער?", `ל-50 בני נוער צריך ${trays({ t: 50 })} מגשים בתיאבון רגיל, ו-${trays({ t: 50, a: "large" })} אם הפיצה היא הארוחה המרכזית של הערב.`],
      ["כמה משולשי פיצה אוכל ילד ביום הולדת?", `בממוצע ${CHILD_UNITS} משולשים לילד בגיל 7–12 וכ-${YOUNG_CHILD_UNITS} לילד בגן. נוער ומבוגרים אוכלים כ-${TEEN_ADULT_UNITS} משולשים.`],
      ["לכמה ילדים מספיק מגש פיצה אחד?", `מגש של ${SLICES} משולשים מספיק לכ-${SLICES / CHILD_UNITS} ילדים בגיל בית ספר, לכ-5 ילדי גן, או לשניים–שלושה מבוגרים.`],
      ["כדאי להזמין מגש רזרבה?", "אם הפיצה היא הארוחה המרכזית והאירוע בשעת ערב, כדאי. במחשבון אפשר לסמן תוספת של 10% ולראות אם היא מוסיפה מגש."],
    ],
  },
  {
    slug: "mesibat-kita",
    nav: "פיצה למסיבת כיתה",
    title: "פיצה למסיבת כיתה: כמה מגשים להזמין ל-30 ילדים? | פיצה וירטואוז",
    description: `כמה מגשי פיצה להזמין למסיבת כיתה: טבלת כמויות ל-20 עד 40 תלמידים, ליסודי ולחטיבה. לכיתה של 30 ביסודי צריך ${trays({ c: 30 })} מגשים. טיפים לוועד הכיתה.`,
    kicker: "מדריך כמויות · מסיבת כיתה",
    h1: "פיצה למסיבת כיתה: כמה מגשים להזמין?",
    lead: `לכיתה של 30 תלמידים ביסודי צריך ${trays({ c: 30 })} מגשים בתיאבון רגיל. בחטיבה ובתיכון אוכלים יותר, ואותה כיתה כבר צריכה ${trays({ t: 30 })}. כאן הכמויות לפי גודל הכיתה והגיל.`,
    preset: { event: "school", c: 30, t: 2 },
    quote: "היי, אני מוועד הכיתה ורוצה הצעת מחיר למגשי פיצה למסיבת כיתה",
    body: () => `
    <section class="info-section">
      <h2>כיתות יסודי: טבלת כמויות</h2>
      <p class="lead">החישוב לפי ${CHILD_UNITS} משולשים לתלמיד ו-${SLICES} משולשים במגש. אם המסיבה מיד אחרי ארוחת עשר, תיאבון קל מספיק; בסוף יום לימודים בחרו רגיל.</p>
${table("מגשי פיצה למסיבת כיתה ביסודי", ["תלמידים", ...APPETITE_HEAD],
      [20, 25, 30, 35, 40].map((c) => [th(`${c} תלמידים`), ...byAppetite({ c })]))}
    </section>

    <section class="info-section">
      <h2>חטיבה ותיכון</h2>
      <p class="lead">מגיל 13 מחשבים ${TEEN_ADULT_UNITS} משולשים לתלמיד, כמו למבוגר. ההבדל מהיסודי גדול, וזו הסיבה שמסיבות בחטיבה נגמרות לפעמים בלי פיצה.</p>
${table("מגשי פיצה למסיבת כיתה בחטיבה ובתיכון", ["תלמידים", ...APPETITE_HEAD],
      [20, 25, 30, 35, 40].map((t) => [th(`${t} תלמידים`), ...byAppetite({ t })]))}
    </section>

    <section class="info-section">
      <h2>מסיבת גן: ילדים, גננות והורים</h2>
      <p class="lead">בגן הילדים אוכלים פחות, כ-${YOUNG_CHILD_UNITS} משולשים, אבל כמעט תמיד מגיעים גם צוות הגן והורים. הטבלה מניחה שלושה אנשי צוות ואת מספר ההורים שבעמודה.</p>
${table("מגשי פיצה למסיבת גן", ["ילדי גן", "צוות והורים", "מגשים"],
      [[20, 3], [25, 3], [30, 3], [25, 13], [30, 18]].map(([y, t]) => [th(`${y} ילדים`), `<td>${t}</td>`, cell({ y, t })]))}
      <p>מסיבת חנוכה או סוף שנה בגן, שבה כל משפחה מגיעה עם הורה, דומה יותר לאירוע משפחתי. ספרו את ההורים במחשבון כמבוגרים.</p>
    </section>

    <section class="info-section">
      <h2>מסיבת סיום, צהרון ותנועת נוער</h2>
      <p class="lead">אותו חישוב עובד לכל קבוצה של ילדים. מה שמשתנה הוא הגיל, השעה ומה עוד מוגש.</p>
      <ul class="tips">
        <li><strong>מסיבת סיום שנה.</strong> לרוב בשעות הערב ועם הורים. ספרו את כל המשתתפים, ובחרו תיאבון רגיל גם אם יש עוגות ושתייה.</li>
        <li><strong>צהרון.</strong> הילדים כבר אכלו ארוחת צהריים, ולכן תיאבון קל מתאים. לקבוצה של 25 ילדים זה ${trays({ c: 25, a: "light" })} מגשים.</li>
        <li><strong>פעולה בתנועת נוער.</strong> חניכים בגיל חטיבה אחרי פעולה הם הקהל הרעב ביותר. ל-30 חניכים בחרו תיאבון גדול: ${trays({ t: 30, a: "large" })} מגשים.</li>
        <li><strong>טיול שנתי או יום כיף.</strong> אחרי יום של פעילות בחוץ, אל תחסכו: תיאבון גדול ורזרבה של 10%.</li>
      </ul>
    </section>

    <section class="info-section">
      <h2>איך מחלקים את העלות בין ההורים</h2>
      <p class="lead">החישוב פשוט: מספר המגשים כפול המחיר למגש, חלקי מספר התלמידים. בכיתה של 30 ביסודי מזמינים ${trays({ c: 30 })} מגשים, כלומר כל משפחה משלמת בערך רבע ממחיר מגש.</p>
      <p>את המחיר המדויק מקבלים בהצעת מחיר בוואטסאפ, עם כל המספרים מהמחשבון. אפשר להעביר אותה כמו שהיא לקבוצת ההורים.</p>
    </section>

    <section class="info-section">
      <h2>טיפים לוועד הכיתה</h2>
      <ul class="tips">
        <li><strong>מספר סופי יום קודם.</strong> סגרו רשימת משתתפים ערב לפני, וספרו גם את המורה וההורים המלווים כמבוגרים.</li>
        <li><strong>אלרגיות ורגישויות.</strong> בררו מראש אם יש בכיתה רגישות לגלוטן או ללקטוז, ושאלו את הפיצריה מה אפשר להכין.</li>
        <li><strong>כשרות.</strong> פיצה וירטואוז כשרה בהשגחת הרבנות ראשון לציון, כך שהיא מתאימה לכיתה מעורבת.</li>
        <li><strong>חיתוך ל-16.</strong> לכיתות הנמוכות בקשו משולשים קטנים. הכמות לא משתנה, אבל קל יותר לחלק.</li>
        <li><strong>הצעת מחיר בכתב.</strong> שלחו את התכנון בוואטסאפ וקבלו הצעת מחיר שאפשר להעביר לקבוצת ההורים.</li>
      </ul>

      <h3>איך משתפים את התכנון עם ההורים</h3>
      <p>במחשבון יש כפתור "שיתוף התכנון" שיוצר קישור עם כל המספרים. שולחים אותו לקבוצת הוועד, וכל אחד רואה בדיוק על כמה ילדים ומגשים מדובר.</p>
    </section>`,
    faq: [
      ["כמה פיצות להזמין ל-30 ילדים?", `ל-30 תלמידי יסודי בתיאבון רגיל צריך 60 משולשים, כלומר ${trays({ c: 30 })} מגשים. עם שני מבוגרים מלווים הכמות היא ${trays({ c: 30, t: 2 })} מגשים.`],
      ["כמה פיצות לכיתה של 35 תלמידים בחטיבה?", `בחטיבה מחשבים ${TEEN_ADULT_UNITS} משולשים לתלמיד, ולכן ל-35 תלמידים צריך ${trays({ t: 35 })} מגשים בתיאבון רגיל.`],
      ["כמה פיצות להזמין ל-25 ילדים?", `ל-25 תלמידי יסודי בתיאבון רגיל צריך ${trays({ c: 25 })} מגשים. אם המסיבה אחרי ארוחה, ${trays({ c: 25, a: "light" })} מגשים מספיקים.`],
      ["כמה פיצות להזמין ל-40 ילדים?", `ל-40 תלמידי יסודי צריך ${trays({ c: 40 })} מגשים בתיאבון רגיל. בשכבה של חטיבה, 40 תלמידים צריכים ${trays({ t: 40 })} מגשים.`],
      ["כמה פיצות למסיבת גן?", `לגן של 30 ילדים עם 3 אנשי צוות צריך ${trays({ y: 30, t: 3 })} מגשים. אם מגיעים גם הורים, הוסיפו מגש לכל שניים–שלושה מבוגרים.`],
      ["כמה פיצות למסיבת סיום כיתה ו'?", `לכיתה של 30 בכיתה ו' עם 4 מלווים צריך ${trays({ c: 30, t: 4 })} מגשים בתיאבון רגיל, ו-${trays({ c: 30, t: 4, a: "large" })} אם המסיבה בשעת ערב.`],
      ["האם לספור גם מורים והורים מלווים?", `כן. כל מבוגר נספר כ-${TEEN_ADULT_UNITS} משולשים, ושלושה מבוגרים הם כבר מגש נוסף.`],
      ["איך מחשבים כמה כל הורה משלם?", "מכפילים את מספר המגשים במחיר למגש ומחלקים במספר התלמידים. את המחיר המדויק מקבלים בהצעת מחיר בוואטסאפ."],
    ],
  },
  {
    slug: "misrad",
    nav: "פיצה למשרד",
    title: "כמה פיצות להזמין למשרד? כמויות לישיבה, לצוות ולאירוע חברה | פיצה וירטואוז",
    description: `כמה פיצות להזמין למשרד, לישיבת צוות או לאירוע חברה: טבלאות ל-5 עד 100 איש. ל-10 איש צריך ${trays({ t: 10 })} מגשים, ל-20 איש ${trays({ t: 20 })}. טיפים לטעמים ולתזמון.`,
    kicker: "מדריך כמויות · אירוע משרדי",
    h1: "כמה פיצות להזמין למשרד?",
    lead: `מבוגר אוכל בממוצע ${TEEN_ADULT_UNITS} משולשים, כלומר מגש של ${SLICES} משולשים לכל שניים–שלושה אנשים. לצוות של 12 צריך ${trays({ t: 12 })} מגשים, ולישיבה של 20 איש ${trays({ t: 20 })}.`,
    preset: { event: "office", t: 12 },
    quote: "היי, אני רוצה הצעת מחיר למגשי פיצה לאירוע במשרד",
    body: () => `
    <section class="info-section">
      <h2>טבלת כמויות לפי גודל הצוות</h2>
      <p class="lead">תיאבון קל מתאים לפיצה לצד סלטים או לישיבה קצרה. רגיל הוא ארוחת צהריים. גדול מתאים לערב ארוך, להאקתון או לצוות צעיר ורעב.</p>
${table("מגשי פיצה לפי מספר עובדים", ["עובדים", ...APPETITE_HEAD],
      [5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50].map((t) => [th(`${t} איש`), ...byAppetite({ t })]))}
    </section>

    <section class="info-section">
      <h2>לפי סוג האירוע במשרד</h2>
      <p class="lead">אותו צוות אוכל אחרת בישיבת בוקר ובערב השקה. כך בוחרים את רמת התיאבון במחשבון.</p>
      <ul class="tips">
        <li><strong>ישיבה או הדרכה.</strong> הפיצה היא כיבוד ולא ארוחה, ולכן תיאבון קל. לישיבה של 12 איש זה ${trays({ t: 12, a: "light" })} מגשים.</li>
        <li><strong>ארוחת צהריים לצוות.</strong> הפיצה היא הארוחה, ולכן תיאבון רגיל. לצוות של 15 זה ${trays({ t: 15 })} מגשים.</li>
        <li><strong>ערב צוות, השקה או האקתון.</strong> שעות ארוכות ושעת ערב, ולכן תיאבון גדול. ל-25 איש זה ${trays({ t: 25, a: "large" })} מגשים.</li>
        <li><strong>יום הולדת לעובד או פרידה.</strong> לרוב יש גם עוגה ושתייה, שלא מורידות מהכמות. בחרו תיאבון קל או רגיל לפי השעה.</li>
      </ul>
    </section>

    <section class="info-section">
      <h2>אירוע חברה גדול: 60 עד 100 משתתפים</h2>
      <p class="lead">באירוע גדול ההבדל בין רמות התיאבון הוא כבר כמה מגשים טובים, ולכן כדאי לחשוב על השעה ועל מה שמוגש לצד הפיצה.</p>
${table("מגשי פיצה לאירוע חברה גדול", ["משתתפים", ...APPETITE_HEAD],
      [60, 70, 80, 100].map((t) => [th(`${t} איש`), ...byAppetite({ t })]))}
      <p>מעל 100 משתתפים המחשבון לא נותן המלצה אוטומטית. באירוע כזה מתאמים כמויות, משלוח בכמה סבבים ושעת הגעה ישירות מול הפיצריה.</p>
    </section>

    <section class="info-section">
      <h2>חשבון מהיר בלי מחשבון</h2>
      <p class="lead">מבוגר אוכל כ-${TEEN_ADULT_UNITS} משולשים, ובמגש יש ${SLICES}. לכן מחלקים את מספר האנשים ב-${(SLICES / TEEN_ADULT_UNITS).toFixed(1)} ומעגלים למעלה. ל-12 איש: 12 חלקי ${(SLICES / TEEN_ADULT_UNITS).toFixed(1)} הם ${(12 / (SLICES / TEEN_ADULT_UNITS)).toFixed(1)}, כלומר ${trays({ t: 12 })} מגשים.</p>
    </section>

    <section class="info-section">
      <h2>איך לבחור טעמים לצוות</h2>
      <p class="lead">במשרד תמיד יש מי שרוצה "רגילה" ומי שרוצה תוספות. חלוקה שעובדת: כ-60% מרגריטה, והשאר פטריות וזיתים.</p>
      <ul class="tips">
        <li><strong>לחמישה מגשים:</strong> 3 מרגריטה, מגש פטריות ומגש זיתים.</li>
        <li><strong>לקבוצה גדולה:</strong> הוסיפו בצל או עגבניות, אבל השאירו את המרגריטה כרוב ברור.</li>
        <li><strong>העדפות תזונה:</strong> בררו מראש אם יש טבעונים או רגישים לגלוטן, ושאלו את הפיצריה מה אפשר להכין.</li>
      </ul>

      <h3>לפני שמזמינים</h3>
      <ul class="tips">
        <li>הזמינו מראש ליום ולשעה מדויקים, במיוחד לישיבה עם לוח זמנים.</li>
        <li>אם מוגש גם אוכל משביע נוסף, סמנו זאת במחשבון והכמות תרד בכ-15%.</li>
        <li>לאירוע של יותר מ-100 משתתפים אין המלצה אוטומטית. במקרה כזה מתאמים ישירות מול הפיצריה.</li>
        <li>שלחו מישהו לקבל את המשלוח בכניסה לבניין, ושמרו שולחן פנוי לפני שהמגשים מגיעים.</li>
        <li>צריכים חשבונית על שם החברה? ציינו את זה כבר בבקשת הצעת המחיר.</li>
      </ul>
    </section>`,
    faq: [
      ["כמה פיצות להזמין ל-5 אנשים?", `ל-5 מבוגרים בתיאבון רגיל צריך ${trays({ t: 5 })} מגשים.`],
      ["כמה פיצות להזמין ל-10 אנשים?", `ל-10 מבוגרים בתיאבון רגיל צריך 30 משולשים, כלומר ${trays({ t: 10 })} מגשים.`],
      ["כמה פיצות לישיבת צוות של 12 איש?", `לישיבה שבה הפיצה היא כיבוד מספיקים ${trays({ t: 12, a: "light" })} מגשים. אם היא ארוחת הצהריים, הזמינו ${trays({ t: 12 })}.`],
      ["כמה פיצות ל-15 איש?", `ל-15 מבוגרים צריך ${trays({ t: 15 })} מגשים בתיאבון רגיל.`],
      ["כמה פיצות ל-20 איש?", `ל-20 מבוגרים צריך ${trays({ t: 20 })} מגשים בתיאבון רגיל, ו-${trays({ t: 20, a: "large" })} אם הצוות רעב במיוחד.`],
      ["כמה פיצות ל-30 איש?", `ל-30 מבוגרים צריך ${trays({ t: 30 })} מגשים בתיאבון רגיל.`],
      ["כמה פיצות ל-50 איש?", `ל-50 מבוגרים בתיאבון רגיל צריך ${trays({ t: 50 })} מגשים. לצד סלטים ומנות נוספות אפשר להסתפק ב-${trays({ t: 50, a: "light" })}.`],
      ["כמה פיצות ל-100 איש?", `ל-100 מבוגרים בתיאבון רגיל צריך ${trays({ t: 100 })} מגשים. באירוע בגודל כזה כדאי לתאם את הכמות והמשלוח ישירות מול הפיצריה.`],
      ["לכמה אנשים מספיק מגש פיצה אחד?", `מגש של ${SLICES} משולשים מספיק לשניים–שלושה מבוגרים, לפי ${TEEN_ADULT_UNITS} משולשים לאדם.`],
      ["איזה טעמים להזמין למשרד?", "חלוקה שעובדת: כ-60% מרגריטה והשאר פטריות וזיתים. בררו מראש אם יש טבעונים או רגישים לגלוטן."],
    ],
  },
];

// ---------- page template ----------

const jsonLd = (data) => `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;

function page(guide) {
  const url = `${SITE}/${guide.slug}/`;
  const others = GUIDES.filter((g) => g !== guide);
  const quoteUrl = `${WHATSAPP}?text=${encodeURIComponent(guide.quote)}`;
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${guide.title}</title>
<meta name="description" content="${guide.description}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#1c1714">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/logo.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="preload" as="image" href="/images/hero-pizza.webp" imagesrcset="/images/hero-pizza-800.webp 800w, /images/hero-pizza.webp 1672w" imagesizes="100vw" fetchpriority="high">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@700;900&family=Rubik:wght@400;500;700&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<noscript><link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@700;900&family=Rubik:wght@400;500;700&display=swap" rel="stylesheet"></noscript>
<link rel="stylesheet" href="/styles.css">

<meta property="og:type" content="article">
<meta property="og:locale" content="he_IL">
<meta property="og:site_name" content="${CONFIG.brandName}">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${guide.h1}">
<meta property="og:description" content="${guide.description}">
<meta property="og:image" content="${SITE}/images/og-pizza-calc.jpg">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">

${jsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "מחשבון פיצה לאירועים", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: guide.nav, item: url },
    ],
  })}
${jsonLd({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: guide.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  })}
</head>
<body class="guide-page">

<a class="skip-link" href="#main-content">דלגו לתוכן הראשי</a>

<header class="site-header">
  <a class="brand" href="/">
    <img src="/logo.svg" alt="" width="36" height="36" class="brand-logo">
    <span>${CONFIG.brandName}</span>
  </a>
  <a class="header-kicker" href="/">למחשבון</a>
</header>

<main id="main-content">

  <section class="intro">
    <img class="intro-photo" src="/images/hero-pizza.webp" srcset="/images/hero-pizza-800.webp 800w, /images/hero-pizza.webp 1672w" sizes="100vw" width="1672" height="941" fetchpriority="high" decoding="async" alt="">
    <div class="intro-text wrap">
      <p class="intro-kicker">${guide.kicker}</p>
      <h1>${guide.h1}</h1>
      <p class="subtitle">${guide.lead}</p>
      <div class="guide-actions">
        <a class="btn btn-primary" href="${preset(guide.preset)}"><span class="btn-label">לחישוב מדויק במחשבון</span></a>
      </div>
    </div>
  </section>

  <div class="wrap content">
${guide.body()}

    <section class="info-section">
      <h2 class="faq-heading">שאלות נפוצות</h2>
      <dl class="faq">
${guide.faq.map(([q, a]) => `        <div>\n          <dt>${q}</dt>\n          <dd>${a}</dd>\n        </div>`).join("\n")}
      </dl>
    </section>

    <section class="info-section">
      <h2>מדריכים נוספים</h2>
      <ul class="guide-links">
        <li><a href="/"><strong>מחשבון הפיצה</strong><span>מזינים כמה מגיעים ומקבלים כמות מגשים</span></a></li>
${others.map((g) => `        <li><a href="/${g.slug}/"><strong>${g.nav}</strong><span>${g.h1}</span></a></li>`).join("\n")}
      </ul>
    </section>
  </div>

  <section class="closing" aria-labelledby="closingHeading">
    <img class="closing-photo" src="/images/hero-pizza.webp" srcset="/images/hero-pizza-800.webp 800w, /images/hero-pizza.webp 1672w" sizes="100vw" width="1672" height="941" loading="lazy" decoding="async" alt="">
    <div class="closing-inner wrap">
      <h2 id="closingHeading">יש כמות. נשאר לסגור את הפינה.</h2>
      <p>שולחים הודעה בוואטסאפ ומקבלים הצעת מחיר ישירות מ${CONFIG.brandName}.</p>
      <div class="closing-actions">
        <a class="btn btn-primary" href="${quoteUrl}" target="_blank" rel="noopener"><span class="btn-label">בקשת הצעת מחיר בוואטסאפ</span></a>
        <a class="closing-phone" href="tel:${CONFIG.restaurantPhone.replace(/-/g, "")}">או בטלפון: <bdi>${CONFIG.restaurantPhone}</bdi></a>
      </div>
    </div>
  </section>

</main>

<div class="analytics-consent" id="analyticsConsent" role="region" aria-labelledby="analyticsConsentTitle" hidden>
  <div class="analytics-consent-copy">
    <strong id="analyticsConsentTitle">עוגיות ומדידת שימוש</strong>
    <p>בהסכמתכם, נשתמש ב-Google Analytics כדי להבין כיצד משתמשים במחשבון ולשפר אותו. אפשר לסרב ולהמשיך להשתמש בו כרגיל.</p>
  </div>
  <div class="analytics-consent-actions">
    <button type="button" class="consent-btn consent-btn-accept" id="analyticsAccept">מאשר/ת</button>
    <button type="button" class="consent-btn" id="analyticsReject">לא תודה</button>
  </div>
</div>

<footer class="site-footer">
  <p><strong>${CONFIG.brandName}</strong> — פיצריה כשרה בראשון לציון, ברחוב ז'בוטינסקי 16. ${CONFIG.openingHours}.</p>
  <p>הכמויות הן הערכת תכנון; המחיר הסופי נקבע מול ${CONFIG.brandName}.</p>
  <p class="footer-links">
    <a href="/">מחשבון הפיצה</a>
    ·
${GUIDES.map((g) => `    <a href="/${g.slug}/">${g.nav}</a>\n    ·`).join("\n")}
    <a href="${CONFIG.siteUrl}">האתר הראשי</a>
    ·
    <a href="${CONFIG.orderUrl}">מערכת ההזמנות</a>
    ·
    <a href="/#accessibility-statement">הצהרת נגישות</a>
    <span id="analyticsSettings" hidden>
      ·
      <button type="button" class="footer-link-btn">הגדרות פרטיות</button>
    </span>
  </p>
</footer>

<script type="module">
  import { initAnalyticsConsent } from "/analytics.js";
  initAnalyticsConsent();
</script>
<script>
  window.OpenNagishConfig = { lang: "he", position: "bottom-left", statementUrl: "/#accessibility-statement" };
</script>
<script src="/open-nagish.min.js" defer></script>
<script src="/a11y-tint.js" defer></script>
</body>
</html>
`;
}

// ---------- quantity tables inside index.html ----------

function indexQuantities() {
  return `
      <h3>ילדים בגיל בית ספר</h3>
${table("מגשי פיצה לפי מספר ילדים", ["ילדים", ...APPETITE_HEAD],
    [10, 15, 20, 25, 30, 40].map((c) => [th(`${c} ילדים`), ...byAppetite({ c })]))}

      <h3>נוער ומבוגרים</h3>
${table("מגשי פיצה לפי מספר מבוגרים", ["מבוגרים", ...APPETITE_HEAD],
    [10, 15, 20, 30, 40, 50].map((t) => [th(`${t} מבוגרים`), ...byAppetite({ t })]))}
      `;
}

export function build() {
  const files = {};
  for (const guide of GUIDES) files[`${guide.slug}/index.html`] = page(guide);

  const START = "<!-- quantities:start (generated by build-guides.mjs) -->";
  const END = "<!-- quantities:end -->";
  const index = readFileSync(path.join(root, "index.html"), "utf8").replace(/\r\n/g, "\n");
  const from = index.indexOf(START);
  const to = index.indexOf(END);
  if (from === -1 || to === -1) throw new Error("index.html: quantities markers not found");
  files["index.html"] = index.slice(0, from + START.length) + indexQuantities() + index.slice(to);
  return files;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [file, content] of Object.entries(build())) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
    console.log("wrote", file);
  }
}
