## TryME (Virtual Try-On MVP)

This app currently includes:
- **Firebase Google login**
- **Onboarding**: upload a base photo to Firebase Storage + save profile in Firestore
- **Swipe deck UI** (Tinder-style) with a mocked “Try on” (next step: connect backend → Fal.ai)

## 1) Install + run

```bash
npm install
npm run android
```

## 2) Firebase setup (required)

### Environment variables
Copy `.env.example` → `.env` and fill:
- `EXPO_PUBLIC_FIREBASE_*` (from Firebase project settings)
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (Google OAuth Client ID)

### Auth (Google)
In Firebase Console:
- **Authentication → Sign-in method → Google**: enable it
- In Google Cloud Console (OAuth client), add an **Authorized redirect URI** for Expo:
  - `tryme://login`

### Firestore
Create a Firestore database (production/test mode).
The app writes a document:
- `profiles/{uid}` with `basePhotoUrl`, `email`, `displayName`.

### Storage
Enable Firebase Storage.
The app uploads:
- `base-photos/{uid}.jpg`

## 3) Where to connect Fal.ai

The swipe screen is `app/swipe.jsx`.
Replace the mocked `runTryOn()` with a call to your backend endpoint, e.g.:
- `POST /tryon` → returns `{ imageUrl }`
