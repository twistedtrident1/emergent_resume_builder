# Emergent Labs

ADHD-friendly daily planner built with Expo/React Native and a FastAPI backend.

## Run on Kubuntu

Kubuntu is supported through Expo Web in a Linux browser. Install the prerequisites:

```bash
sudo apt update
sudo apt install -y nodejs npm python3 python3-venv
```

Start the backend in one terminal:

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --reload --host 127.0.0.1 --port 8000
```

Start the web app in another terminal:

```bash
cd frontend
npm install
npm run web
```

Expo will print a local URL. Open it in Firefox or Chromium on Kubuntu. The frontend uses `http://127.0.0.1:8000` for the backend by default; set `EXPO_PUBLIC_BACKEND_URL` in `frontend/.env.local` if the backend is hosted elsewhere.

The backend also needs `MONGO_URL` and `DB_NAME` in `backend/.env` before it can start. Use the values for your MongoDB instance. If Google sign-in returns to the login screen, check that the backend is running and that `frontend/.env.local` points to it:

```dotenv
EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
```

Restart Expo after changing `.env.local`.

## Native mobile builds

Android and iOS remain available through Expo's standard commands. Kubuntu does not provide an iOS simulator; Android builds require the Android SDK/emulator.
