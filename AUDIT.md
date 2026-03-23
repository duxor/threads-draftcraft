# Threads DraftCraft - Detaljan Audit Aplikacije

**Datum:** 2026-03-21
**Verzija:** 1.0.0
**Tip aplikacije:** Chrome Extension (Manifest V3)
**Ukupno linija koda:** ~3,830

---

## 1. PREGLED ARHITEKTURE

### Struktura
```
background/background.js  (433 LOC)  - Service worker, lifecycle, messaging
content/content.js         (1,351 LOC) - DOM manipulacija na threads.com
content/content.css        (446 LOC)  - Stilovi za content script
popup/popup.html           (159 LOC)  - Popup UI
popup/popup.js             (611 LOC)  - Popup kontroler
popup/popup.css            (783 LOC)  - Popup stilovi
manifest.json              (47 LOC)   - Extension konfiguracija
```

### Ocjena arhitekture: 7/10
- Dobra separacija (background/content/popup)
- Class-based pristup je konzistentan
- Nema build sistema, lintinga, ni testova

---

## 2. SIGURNOSNI PROBLEMI

### 2.1 KRITIČNO: innerHTML koriscenje bez sanitizacije

**Fajlovi:** `content/content.js:890`, `content/content.js:1258-1268`, `content/content.js:1309-1324`, `popup/popup.js:548-561`

```javascript
// content.js:890 - Sort indicator
statusIndicator.innerHTML = `<span style="...">...${this.sortOrder}...</span>`;

// content.js:1258 - Time indicator fallback
timeIndicator.innerHTML = `<div style="...">📅 ${draft.scheduledTimeStr}</div>`;

// content.js:1309 - Count badge
countBadge.innerHTML = `<span style="...">📊 ${this.drafts.length}</span>`;

// popup.js:548 - Info message
infoDiv.innerHTML = `<div style="...">📌 Navigate to Threads.com...</div>`;
```

**Rizik:** Dok su `this.sortOrder` i `this.drafts.length` kontrolisane vrijednosti, `draft.scheduledTimeStr` dolazi iz parsiranog DOM sadrzaja Threads.com stranice. Ako bi napadac kontrolisao sadrzaj koji se renderuje na Threads.com (npr. kroz draft tekst koji sadrzi `<script>` ili event handlere), mogao bi izvrsiti XSS napad.

**Preporuka:** Koristiti `textContent` umjesto `innerHTML` ili sanitizirati sve ulazne podatke. Za kompleksne HTML strukture koristiti DOM API (`createElement`, `appendChild`).

### 2.2 SREDNJE: web_accessible_resources previse otvoren

**Fajl:** `manifest.json:41-46`

```json
"web_accessible_resources": [{
  "resources": ["content/*"],
  "matches": ["https://*.threads.com/*"]
}]
```

**Rizik:** Izlaze cijeli `content/` direktorij. Ovo dozvoljava threads.com stranicama da pristupe resursima ekstenzije, sto moze pomoci fingerprinting-u ili probe-anju.

**Preporuka:** Specificirati samo fajlove koji su zaista potrebni kao web-accessible, ili ukloniti ovu sekciju ako content scripts ne zahtijevaju pristup resursima sa web stranice.

### 2.3 NISKO: Console logging u produkciji

**Svi fajlovi** sadrze opsezno logovanje:
```javascript
console.log('[Threads DraftCraft] Background script initialized');
console.log('[Threads DraftCraft] Settings saved:', settings);
console.log('[Threads DraftCraft] Received message:', message, 'from:', sender);
```

**Rizik:** Leak korisnickih podataka (draft sadrzaj, settings) u konzolu. Moze biti vidljivo drugim ekstenzijama ili alatima.

**Preporuka:** Implementirati log level sistem ili ukloniti detaljno logovanje za produkcijsku verziju.

---

## 3. BAGOVI I LOGICKI PROBLEMI

### 3.1 BUG: Dupla inicijalizacija u background.js

**Fajl:** `background/background.js:21-22` i `background/background.js:29-31`

```javascript
// U constructor-u:
this.handleInstallation(); // Linija 22

// Ali takodje:
chrome.runtime.onInstalled.addListener((details) => {
  this.handleOnInstalled(details); // Linija 30
});
```

`handleInstallation()` se poziva svaki put kad se service worker pokrene (ukljucujuci wake-up iz idle stanja), dok `handleOnInstalled` se poziva samo pri instalaciji/update-u. Ovo znaci da se `initializeDefaultSettings()` provjerava nepotrebno pri svakom budjenju service worker-a.

**Preporuka:** Ukloniti `this.handleInstallation()` iz `init()` i osloniti se iskljucivo na `onInstalled` event.

### 3.2 BUG: Random vrijeme za day-only drafts

**Fajl:** `content/content.js:740-744`

```javascript
const randomHour = Math.floor(Math.random() * 12) + 9;
const randomMinute = Math.floor(Math.random() * 60);
scheduledDate.setHours(randomHour, randomMinute, 0, 0);
```

Kad draft ima samo dan (npr. "Sunday") bez specificnog vremena, generise se **random** vrijeme. To znaci da ce se svaki put kad se drafts ponovo procesiraju, redoslijed mijenjati. Ovo prouzrokuje nestabilan UI - drafts ce "skakati" po listi pri svakom refresh-u.

**Preporuka:** Koristiti deterministicko fallback vrijeme bazirano na poziciji drafta (npr. `9 + index * 2` sati).

### 3.3 BUG: Slican problem sa "today"/"tomorrow" fallback

**Fajl:** `content/content.js:750-759`

```javascript
// "posting today" bez specificnog vremena
const hoursFromNow = Math.floor(Math.random() * 8) + 1;
return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
```

Isti problem - random vrijednosti ce izazvati nestabilan sort pri svakom procesiranju.

### 3.4 BUG: scheduledDrafts u popup.js prikazuje totalDrafts umjesto scheduled count

**Fajl:** `popup/popup.js:264`

```javascript
if (scheduledDrafts) {
  scheduledDrafts.textContent = stats.totalDrafts || '0'; // BUG: koristi totalDrafts
}
```

Element `scheduledDrafts` bi trebao prikazivati samo scheduled drafts, ali koristi `stats.totalDrafts`. Content script ne salje odvojen `scheduledDrafts` count.

**Preporuka:** U `getDraftStats` response dodati `scheduledDrafts` polje i koristiti ga u popup-u.

### 3.5 BUG: daysUntil moze biti 0

**Fajl:** `content/content.js:734-736`

```javascript
let daysUntil = targetDayIndex - currentDayIndex;
if (daysUntil < 0) {
  daysUntil += 7;
}
```

Ako je danas isti dan kao target (npr. "Monday" i danas je Monday), `daysUntil` ce biti 0, sto znaci da ce draft biti scheduliran za danas. Moguce je da korisnik misli na slijedeci ponedeljak.

### 3.6 BUG: MutationObserver nema disconnect

Content script MutationObserver nikada se ne disconnectuje. Ovo moze dovesti do memory leak-ova ako korisnik dugo ostane na stranici i DOM se cesto mijenja.

**Preporuka:** Sacuvati referencu na observer i disconnectovati ga kad dialog nestane.

---

## 4. PERFORMANSE

### 4.1 SREDNJE: MutationObserver na cijelom body-ju sa subtree: true

**Fajl:** `content/content.js:133-136`

```javascript
observer.observe(document.body, {
  childList: true,
  subtree: true
});
```

Ovo hvata SVAKU promjenu u DOM-u na cijeloj stranici. Na kompleksnim SPA stranicama kao sto je Threads.com, ovo moze generisati hiljade mutacija u sekundi.

**Preporuka:** Suziti scope posmatranja na specifican container ili koristiti debounce/throttle za procesiranje.

### 4.2 NISKO: Ponovljeni DOM query-ji

`isDraftsDialog()` koristi `element.textContent.toLowerCase()` na potencijalno velikim elementima. Ovo se poziva za svaku mutaciju, sto moze biti skupo.

### 4.3 NISKO: collectScheduledByDate() se poziva za svaki date divider

**Fajl:** `content/content.js:1157`

Unutar `addDateDividers()` petlje, `this.collectScheduledByDate()` se poziva za svaki novi datum, ali rezultat bi mogao biti izracunat jednom izvan petlje.

---

## 5. KVALITET KODA

### 5.1 Duplikacija koda - Toggle handler-i u popup.js

**Fajl:** `popup/popup.js:280-412`

Svi toggle handler-i (`handleSortOrderChange`, `handleAutoSortToggle`, `handleTimeIndicatorsToggle`, `handleDraftCountToggle`, `handleSortIndicatorToggle`, `handleDateDividerToggle`) imaju gotovo identican pattern:

```javascript
async handleXxxToggle(enabled) {
  this.settings.xxx = enabled;
  await this.saveSettings();
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url.includes('threads.com')) {
      await chrome.tabs.sendMessage(tab.id, { action: 'toggleXxx', enabled });
    }
  } catch (error) { ... }
  this.showSuccess(enabled ? 'Xxx enabled' : 'Xxx disabled');
}
```

**Preporuka:** Kreirati genericku helper metodu:
```javascript
async toggleSetting(key, action, enabled, label) {
  this.settings[key] = enabled;
  await this.saveSettings();
  await this.sendToActiveTab({ action, enabled });
  this.showSuccess(enabled ? `${label} enabled` : `${label} disabled`);
}
```

### 5.2 Inline stilovi umjesto CSS klasa

**Fajlovi:** `content/content.js:891-898`, `content/content.js:1241-1249`, `content/content.js:1259-1265`, `content/content.js:1310-1321`, `popup/popup.js:549-557`

Vise od 5 mjesta koristi inline `style` atribute umjesto CSS klasa definisanih u content.css.

**Preporuka:** Premjestiti sve stilove u CSS fajlove. Koriscenje inline stilova otezava odrzavanje i onemogucava dark mode/accessibility overrides.

### 5.3 Magic numbers

- `text.length > 20 && text.length < 500` (content.js:368)
- `text.length < 5` (content.js:411)
- `randomHour = Math.floor(Math.random() * 12) + 9` (content.js:741)
- `30*60000` (content.js:972) - 30 minuta
- `37` (content.js:1057) - "prime-ish step"

**Preporuka:** Izdvojiti u imenovane konstante za bolju citljivost.

### 5.4 hasScheduleableContent() i extractScheduledTime() duplikacija

**Fajl:** `content/content.js:408-501` i `content/content.js:559-790`

Ove dvije metode dijele gotovo identican set regex pattern-a i logike za prepoznavanje vremena i dana. Promjena u jednoj metodi zahtijeva istu promjenu u drugoj.

**Preporuka:** Izdvojiti zajednicki set pattern-a u konstantu klase ili helper metodu.

---

## 6. MANIFEST I PERMISIJE

### 6.1 Permisije su ispravne i minimalne

- `storage` - Potrebno za cuvanje settings-a
- `activeTab` - Potrebno za komunikaciju sa aktivnim tab-om
- `scripting` - Potrebno za dinamicko injektovanje content script-a

### 6.2 Host permissions su ispravne

```json
"host_permissions": ["https://*.threads.com/*"]
```

Ograniceno samo na threads.com domenu.

### 6.3 Content Security Policy

Manifest V3 automatski primjenjuje strogi CSP. Nema custom CSP u manifest.json, sto je dobro - default je najsigurniji.

---

## 7. ACCESSIBILITY

### 7.1 Dobro
- CSS ima `prefers-reduced-motion: reduce` support
- CSS ima `prefers-contrast: more` support
- Focus outlines su definirani
- `aria-label` se koristi na nekim elementima (date count badge)

### 7.2 Nedostaje
- Popup HTML nema `aria-label` na toggle switch-evima
- Nema ARIA live regions za dinamicki sadrzaj (success/error poruke)
- Close dugmici za error/success poruke nemaju `aria-label`
- Nema keyboard navigacije za suggestion badge-ove

**Preporuka:** Dodati `aria-label`, `role="alert"` za poruke, `role="status"` za statistike.

---

## 8. KOMPATIBILNOST I ROBUSTNOST

### 8.1 Fragilni DOM selektori

**Fajl:** `content/content.js:117`

```javascript
const dialogElements = document.querySelectorAll('[role="dialog"], .x1n2onr6');
```

Klasa `.x1n2onr6` je automatski generisana (vjerovatno od CSS-in-JS build sistema Threads.com) i moze se promijeniti u bilo kojem update-u.

**Rizik:** Svaki Threads.com deploy moze slomiti detekciju dialog-a.

**Preporuka:** Osloniti se vise na semanticke atribute (`[role="dialog"]`) i sadrzajnu detekciju nego na generisane klase.

### 8.2 Tekstualna detekcija je jezicno zavisna

```javascript
const editIndicators = [
  'new thread', 'add a topic', 'what\'s new?', ...
];
const draftsIndicators = [
  'posting tomorrow at', 'posting today at', ...
];
```

Ovi stringovi rade samo za engleski interfejs. Korisnici sa drugim jezickim podesavanjima nece dobiti funkcionalnost.

**Preporuka:** Dokumentovati ogranicenje ili implementirati multi-language support.

### 8.3 Nema graceful degradation

Ako Threads.com promijeni strukturu, ekstenzija nece raditi, ali nece ni obavijestiti korisnika. Ne postoji mehanizam za detekciju da li je content script uspjesno pronasao i procesirao drafts.

---

## 9. TESTOVI I CI/CD

### Status: NE POSTOJI

- Nema unit testova
- Nema integration testova
- Nema lintinga (ESLint)
- Nema type checking-a (TypeScript/JSDoc)
- Nema build pipeline-a
- Nema CI/CD konfiguracije
- Nema package.json

**Preporuka:** Minimalno dodati:
1. `package.json` sa dev dependencies
2. ESLint konfiguraciju
3. Unit testove za parsiranje vremena (najkritaniji dio)
4. GitHub Actions za lint

---

## 10. REZIME NALAZA

| Kategorija | Kriticno | Srednje | Nisko |
|---|---|---|---|
| Sigurnost | 1 (innerHTML/XSS) | 1 (web_accessible_resources) | 1 (console logging) |
| Bagovi | 3 (random sort, wrong stats, no disconnect) | 1 (daysUntil=0) | 1 (dupla init) |
| Performanse | 0 | 1 (MutationObserver scope) | 2 (DOM queries, repeated calc) |
| Kvalitet koda | 0 | 2 (duplikacija, inline stilovi) | 2 (magic numbers, dupli regex) |
| Accessibility | 0 | 1 (ARIA nedostaje) | 0 |
| Kompatibilnost | 0 | 2 (fragilni selektori, jezik) | 1 (graceful degradation) |
| Testovi | 1 (nema testova) | 0 | 0 |

### Ukupna ocjena: 6.5/10

**Pozitivno:**
- Cista class-based arhitektura
- Minimalne permisije
- Dark mode i accessibility osnove
- Zero dependencies
- Manifest V3 (najnoviji standard)
- Dobra separacija koncepata

**Potrebno popraviti (prioritet):**
1. Zamijeniti `innerHTML` sa sigurnim DOM API-jem
2. Fiksirati random-based scheduling (nestabilan sort)
3. Fiksirati scheduledDrafts count u popup-u
4. Dodati MutationObserver cleanup
5. Smanjiti scope MutationObserver-a
6. Dodati ESLint i osnovne unit testove
7. Premjestiti inline stilove u CSS
8. Refaktorisati duplirane toggle handler-e
