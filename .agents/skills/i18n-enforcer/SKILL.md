---
name: i18n-enforcer
description: Enforces full multi-language UI translation coverage across all supported locales whenever new UI text, modals, settings, or labels are added or modified in the project.
---

# Multi-Language UI Translation Enforcer

Use this skill whenever adding new UI text, buttons, modals, settings, context menus, tooltips, or notices to ensure that **ALL** supported project languages are fully translated without leaving missing keys or English fallbacks.

## Supported Locales in `src/i18n.ts`
1. `en` (English - Reference Schema)
2. `zh` / `zh-cn` (Simplified Chinese)
3. `zhTW` / `zh-tw` (Traditional Chinese)
4. `es` (Spanish)
5. `fr` (French)
6. `de` (German)
7. `ja` (Japanese)
8. `ko` (Korean)
9. `ru` (Russian)
10. `pt` / `pt-br` (Portuguese)
11. `it` (Italian)
12. `ar` (Arabic)
13. `he` (Hebrew)

---

## Required Workflow When Adding/Updating UI Text

### Step 1: Add Key(s) to `TranslationSchema`
Every user-facing string MUST have a corresponding key in `TranslationSchema` in `src/i18n.ts`.

- If the text is static, define it as a string property:
  ```ts
  newUiLabel: string;
  ```
- If the text has dynamic parameters, define it as a function property:
  ```ts
  newUiNotice: (count: number) => string;
  ```

### Step 2: Update Reference Schema (`en`)
Add the default English implementation to `const en: TranslationSchema`.

### Step 3: Populate ALL 12 Remaining Locale Objects
You **MUST** update all of the following locale dictionaries in `src/i18n.ts`:
- `const zh: TranslationSchema`
- `const zhTW: TranslationSchema`
- `const es: TranslationSchema`
- `const fr: TranslationSchema`
- `const de: TranslationSchema`
- `const ja: TranslationSchema`
- `const ko: TranslationSchema`
- `const ru: TranslationSchema`
- `const pt: TranslationSchema`
- `const it: TranslationSchema`
- `const ar: TranslationSchema`
- `const he: TranslationSchema`

> **CRITICAL RULE**: Do NOT rely on English fallback for any supported language. Every single key defined in `TranslationSchema` must have explicit translations across all 13 locale objects.

### Step 4: Use `getText()` in Source UI Components
Never hardcode raw string literals in UI components, modals, or settings panels. Always import `getText` from `../i18n` or `./i18n` and call the key dynamically:

```ts
import { getText } from '../i18n';

// In UI code:
const t = getText();
button.setText(t.newUiLabel);
```

### Step 5: Verification & Type Checking
After adding or editing translations, ALWAYS run the build script to ensure complete type compliance across all locale schemas:

```bash
npm run build
```

If TypeScript emits an error like:
`Type '{ ... }' is missing the following properties from type 'TranslationSchema'`, check the error output to identify which locale dictionary was missed and populate the missing keys immediately.
