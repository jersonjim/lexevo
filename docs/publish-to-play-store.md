# How to Publish Lexevo to Google Play Store

This guide covers everything from zero to a published app. Follow it in order.

---

## Prerequisites

Before you start, you need:

- A **Google Play Console account** (one-time $25 fee at play.google.com/console)
- An **Expo account** (free at expo.dev)
- **EAS CLI** installed globally
- The app building and running locally

---

## Part 1 — One-time setup (already done for Lexevo)

These steps were already completed. They're documented here in case you need to redo them on a new machine or new project.

### 1.1 Install EAS CLI

```bash
sudo npm install -g eas-cli
```

### 1.2 Log in to your Expo account

```bash
eas login
```

This opens a browser window. Log in with your Expo credentials.

To verify you're logged in:

```bash
eas whoami
```

### 1.3 Configure EAS for the project

Inside the project folder:

```bash
eas build:configure
```

- When asked to create an EAS project → **Y**
- When asked for platform → **Android**

This creates `eas.json` in the project root and adds the `projectId` to `app.json`.

### 1.4 Set the Android package name

In `app.json`, under `"android"`, set a unique package name. This can never be changed after you publish:

```json
"android": {
  "package": "com.lexevostudio.lexevo"
}
```

The convention is reverse domain: `com.yourcompany.appname`.

---

## Part 2 — Assets (already done for Lexevo)

Play Store requires specific assets. All of these are saved in `assets/store/`.

### 2.1 App icon

- Size: **1024×1024px**
- Format: PNG, no transparency
- File: `assets/icon.png` (also copied to `assets/adaptive-icon.png`)
- This is the icon users see on their home screen

### 2.2 Feature graphic (banner)

- Size: **1024×500px minimum** (Lexevo's is 1794×876)
- Format: JPEG or PNG
- File: `assets/store/feature-graphic.png`
- This is the banner shown at the top of your Play Store listing

### 2.3 Screenshots

- Minimum **2 screenshots**, recommended 4–8
- Format: JPEG or PNG
- Dimensions: minimum 320px, maximum 3840px on any side
- Files: `assets/store/screenshots/screenshot-1.jpg` through `screenshot-5.png`
- Taken from a real device running the app via Expo Go

---

## Part 3 — Privacy Policy (already done for Lexevo)

Google requires a Privacy Policy for any app that uses authentication or collects user data.

### 3.1 The policy file

Located at `docs/privacy-policy.html`. It covers:
- What data Lexevo collects (email, vocabulary, study history)
- What it does NOT collect (location, contacts, ads)
- Third-party services (Supabase)
- User rights and contact info

### 3.2 Public URL

The policy is hosted via GitHub Pages at:
`https://jersonjim.github.io/lexevo/privacy-policy.html`

**To update the policy:**
1. Edit `docs/privacy-policy.html`
2. Commit and push — GitHub Pages updates automatically in a few minutes

**To set up GitHub Pages on a new repo:**
1. Repo must be **public**
2. Settings → Pages → Source: `Deploy from a branch`
3. Branch: `main`, Folder: `/docs` → Save

---

## Part 4 — Build the app

This creates the `.aab` file (Android App Bundle) that you upload to Play Store.

### 4.1 Make sure you're on the main branch with latest code

```bash
git checkout main
git pull origin main
```

### 4.2 Run the production build

```bash
eas build --platform android --profile production
```

- EAS builds in the cloud — you don't need Android Studio installed
- First build generates a **keystore** (signing certificate) automatically and stores it securely on Expo's servers. **Never lose this keystore** — you need it for every future update
- Build takes ~15–20 minutes
- You can follow progress at expo.dev/accounts/cherson/projects/lexevo/builds

### 4.3 Download the .aab file

When the build finishes, EAS prints a URL like:
```
🤖 Android app:
https://expo.dev/artifacts/eas/xxxxx.aab
```

Download that `.aab` file to your computer.

---

## Part 5 — Create the app in Play Console

Do this once. After the first time, you go straight to Part 6 for updates.

### 5.1 Create a new app

1. Go to [play.google.com/console](https://play.google.com/console)
2. Click **Create app**
3. Fill in:
   - App name: **Lexevo**
   - Default language: **Spanish** (or your primary language)
   - App or game: **App**
   - Free or paid: **Free**
4. Accept the declarations and click **Create app**

### 5.2 Set up the store listing

Go to **Store presence → Main store listing**:

**App name:** Lexevo

**Short description** (max 80 characters):
> Aprende vocabulario con el método Leitner de repetición espaciada.

**Full description** (max 4000 characters):
> Lexevo es una app de aprendizaje de vocabulario basada en el método Leitner, un sistema de repetición espaciada que te ayuda a recordar palabras para siempre.
>
> ¿Cómo funciona?
> • Agrega las palabras que quieres aprender con su significado
> • Estudia diariamente — las palabras que recuerdas avanzan de caja, las que olvidas vuelven al inicio
> • El sistema programa las revisiones en el momento óptimo para maximizar la retención
>
> Características:
> • Planes Bronze (3 cajas), Silver (5 cajas) y Golden (7 cajas)
> • Importa vocabulario desde archivos CSV
> • Racha diaria de estudio con mascota personalizable
> • Historial de actividad y estadísticas
> • Disponible en español, inglés y portugués
> • Sincronización entre dispositivos

**Graphics:**
- Click **Add phone screenshots** → upload the 5 files from `assets/store/screenshots/`
- Click **Add feature graphic** → upload `assets/store/feature-graphic.png`

### 5.3 Set up content rating

Go to **Policy → App content → Content rating**:
1. Click **Start questionnaire**
2. Category: **Utility**
3. Answer all questions (Lexevo has no violence, no mature content)
4. Submit — you'll receive a rating (likely **Everyone**)

### 5.4 Set up target audience

Go to **Policy → App content → Target audience**:
- Select **18+** (or 13+ if appropriate)
- Answer whether the app appeals to children — **No**

### 5.5 Add Privacy Policy

Go to **Policy → App content → Privacy Policy**:
- Paste the URL: `https://jersonjim.github.io/lexevo/privacy-policy.html`

### 5.6 Set up data safety

Go to **Policy → App content → Data safety**:
- Does your app collect or share user data? **Yes**
- Data collected:
  - **Email address** → Account management, Required, Not shared
  - **User content (photos/videos)** → Avatar photo, Optional, Not shared
- Does your app use encryption? **Yes**
- Does your app follow Google Play's Families Policy? **No**

### 5.7 Select a category

Go to **Store presence → Main store listing → App category**:
- Type: **Application**
- Category: **Education**

---

## Part 6 — Upload the build and release

### 6.1 Go to Production

In Play Console, go to **Release → Production → Create new release**

### 6.2 Upload the .aab

Click **Upload** and select the `.aab` file you downloaded in Part 4.3.

### 6.3 Write release notes

In the **What's new in this release?** box, write:
```
Initial release of Lexevo — vocabulary learning with the Leitner spaced repetition method.
```

### 6.4 Review and submit

Click **Next** → review everything → **Send X changes to review**

Google reviews new apps in **3–7 business days**. You'll get an email when it's approved or if there are issues.

---

## Part 7 — Publishing future updates

For every new version after the first release:

### 7.1 Update the version in app.json

```json
"version": "1.1.0"
```

(`versionCode` is incremented automatically by EAS via `autoIncrement: true` in `eas.json`)

### 7.2 Build

```bash
eas build --platform android --profile production
```

### 7.3 Upload to Play Console

- Play Console → **Release → Production → Create new release**
- Upload the new `.aab`
- Write release notes describing what changed
- Submit

Updates are reviewed faster than initial releases — usually **1–3 hours** for established apps.

---

## Troubleshooting

### "Package name already taken"
The package name `com.lexevostudio.lexevo` must be globally unique across all Android apps. If it's taken, change it in `app.json` — but only before your first release. After publishing, the package name is permanent.

### "Keystore not found"
EAS stores the keystore on Expo's servers. As long as you're logged in with the same Expo account (`eas whoami` → `cherson`), EAS will use the correct keystore automatically.

To download a backup of the keystore (recommended):
```bash
eas credentials
```

### Build fails
Check the full logs at expo.dev/accounts/cherson/projects/lexevo/builds. Common causes:
- Missing environment variables (check `.env` is set up correctly)
- TypeScript errors in the code

### "App rejected by Google"
Read the rejection email carefully. Common reasons:
- Missing privacy policy → already covered
- Misleading description → update the store listing
- Crash on launch → test the production build on a real device first

---

## Important things to never lose

| What | Where | Why |
|---|---|---|
| Keystore | Expo servers (tied to your Expo account) | Required to sign every update |
| Expo account password | Your password manager | Access to build system |
| Google Play Console access | play.google.com/console | Required to publish updates |
| Package name | `app.json` → `android.package` | `com.lexevostudio.lexevo` — permanent |
