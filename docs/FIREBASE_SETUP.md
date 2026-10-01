# Connecting Firebase

The app runs in **local mode** (data in one browser) until these settings exist. Once they do, it asks you to sign in with Google and keeps everything in Firestore, synced across your phone and computer. It also keeps a copy on each device, so it opens fast and works offline.

## 1. Create the project (Firebase console, about 10 minutes)

1. Go to <https://console.firebase.google.com> → **Add project**. Any name, e.g. `my-budget`. Google Analytics isn't needed.
2. **Build → Authentication → Get started → Sign-in method → Google → Enable.** Pick your email as the support email. Save.
3. **Authentication → Settings → Authorized domains → Add domain:** `<your-github-username>.github.io`. (`localhost` is already there.)
4. **Build → Firestore Database → Create database.** Choose a location near you, and start in **production mode**.
5. **Firestore → Rules:** replace everything with the contents of [`firestore.rules`](../firestore.rules), then **Publish**. This makes sure each signed-in person can only read and write their own data.
6. **Project settings (gear icon) → General → Your apps → Web (`</>`)**: register an app (no hosting needed). Copy the `firebaseConfig` values it shows.

## 2. Local development

Copy `.env.example` to `.env.local` (git-ignored) and fill in:

```
VITE_FIREBASE_API_KEY=...        # apiKey
VITE_FIREBASE_AUTH_DOMAIN=...    # authDomain
VITE_FIREBASE_PROJECT_ID=...     # projectId
VITE_FIREBASE_APP_ID=...         # appId
```

Restart `npm run dev`. You'll see the sign-in screen.

## 3. Moving your existing data in

After signing in the first time, open **Settings**. If this browser has data from before (your imported transactions, rules and categories), you'll see **Move this browser's data to your account**. It copies everything with the same ids, so running it twice doesn't create duplicates. It replaces the account's starter categories with yours.

In a browser without that local data, use **Settings → Restore** with `private/my-data.json` instead. That also works once you're signed in.

## 4. GitHub Pages

In the GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**. Add the same four names and values as in `.env.local`. The deploy workflow passes them to the build.

## Notes

- The config values aren't secret; they're in every Firebase web app. Access is controlled by Google sign-in plus the Firestore rules.
- Anyone with a Google account could sign in and get their own, separate, empty budget. They can't see yours. To lock it to just you, add `&& request.auth.token.email == "you@example.com"` to the rule in `firestore.rules` and publish it again. Only do this if your repo is private, since the rules file would show your email.
- Firestore's free tier (50k reads / 20k writes a day) is far more than a personal budget uses.
