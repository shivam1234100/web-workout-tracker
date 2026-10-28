# 🏋️ AI Workout Tracker

A full-stack AI-powered workout tracker with personalized coaching, exercise library, and progress analytics.

**🌐 Live Demo:** [web-workout-tracker.vercel.app](https://web-workout-tracker.vercel.app)

---

## ✨ Features

- **🔐 Authentication** — JWT-based signup/login with bcrypt-hashed passwords, and password reset via a 6-digit emailed code (1-hour expiry, single use)
- **📊 Dashboard** — Personalized greeting, daily motivational quote, workout stats, and recent activity
- **💪 Workout Tracking** — Live session timer, set/rep/weight logging with completion checkmarks, add/remove sets and exercises; the in-progress session survives page refreshes
- **📚 Exercise Library** — 27 exercises with search, muscle-group and difficulty filters, step-by-step instructions, and tutorial links
- **📅 Workout History** — Past workouts with per-set breakdowns, duration, and delete
- **🤖 AI Coach** — Chat with an OpenAI-powered coach that reads your real training data (PRs, volume, progression trends, recent sessions) to give personalized advice; falls back to a rule-based offline coach when no API key is set
- **📈 Weekly Insights** — Monday–Sunday stats (volume, sets, reps, time) plus an AI-written weekly review that refreshes as you log workouts
- **👤 Profile** — Manage name, height, weight, and gender
- **📱 Fully Responsive** — Mobile-first design with bottom nav bar and sidebar overlay

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + Vite 6 |
| **Backend** | Express.js + TypeScript |
| **Database** | MongoDB (via Prisma ORM) |
| **AI** | OpenAI Chat Completions (`gpt-4o-mini` by default) |
| **Hosting** | Vercel (frontend) + Render (backend) + MongoDB Atlas (database) |

---

## 📁 Project Structure

```
├── client/                  # React frontend
│   ├── src/
│   │   ├── pages/           # 10 page components
│   │   ├── components/      # Shared UI (AI text formatting)
│   │   ├── context/         # Auth & Workout state management
│   │   ├── constants/       # API config, mock data
│   │   ├── App.jsx          # Router + sidebar + mobile nav
│   │   ├── index.css        # Premium dark theme design system
│   │   └── main.jsx         # Entry point
│   ├── index.html
│   └── vite.config.js
│
├── backend/                 # Express API
│   ├── routes/
│   │   ├── auth.ts          # Auth, profile, password reset
│   │   ├── workout.ts       # CRUD workouts & exercises
│   │   ├── ai.ts            # AI coach chat with context
│   │   └── summary.ts       # Weekly AI summaries
│   ├── middleware/
│   │   └── auth.ts          # JWT authentication
│   ├── prisma/
│   │   └── schema.prisma    # Database models
│   └── server.ts            # Express app entry
│
└── render.yaml              # Render Blueprint for the backend
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or [MongoDB Atlas](https://cloud.mongodb.com))

### 1. Clone the repo

```bash
git clone https://github.com/shivam1234100/web-workout-tracker.git
cd web-workout-tracker
```

### 2. Backend Setup

```bash
cd backend
npm install

# Create .env from the template and fill in DATABASE_URL and JWT_SECRET
cp .env.example .env

npm run db:push   # creates collections and indexes (e.g. unique email)
npm run build
npm start
# → Backend running on http://localhost:3000
```

### 3. Frontend Setup

```bash
cd client
npm install
npm run dev
# → Frontend running on http://localhost:5173
```

---

## 🌐 Deployment

| Service | Platform | Notes |
|---|---|---|
| **Database** | MongoDB Atlas | Free M0 cluster. Network Access must allow `0.0.0.0/0` (Render has no fixed IPs) |
| **Backend** | Render | Root dir `backend`. Build: `npm ci && npm run db:push && npm run build`, Start: `npm start`, Health check: `/health`. Or use the included `render.yaml` Blueprint |
| **Frontend** | Vercel | Root dir `client`, framework Vite, env `VITE_API_URL` |

### Step by step

1. **MongoDB Atlas** — create a free M0 cluster → *Database Access*: add a user → *Network Access*: add `0.0.0.0/0` → *Connect → Drivers*: copy the connection string and add the database name before the `?` (e.g. `...mongodb.net/ai-workout-tracker?retryWrites=true&w=majority`).
2. **Render** — *New → Blueprint* and pick this repo (uses `render.yaml`), or *New → Web Service* with the settings above. Set `DATABASE_URL`, and optionally `OPENAI_API_KEY` / `RESEND_API_KEY`. After the deploy, open `https://<your-service>.onrender.com/health` — it should return `{"status":"ok"}`.
3. **Vercel** — *Add New → Project*, import this repo, set **Root Directory** to `client`, add `VITE_API_URL=https://<your-service>.onrender.com`, deploy.
4. Back on Render, set `FRONTEND_URL` to your Vercel URL so CORS allows it.

> Render's free tier sleeps after ~15 minutes idle; the first request then takes ~30–60s. The app pings the API on load and shows a "waking up the server" hint on login.

### Environment Variables

**Backend (Render):**
| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | MongoDB connection string (including database name) |
| `JWT_SECRET` | ✅ | Long random string for signing login tokens |
| `NODE_ENV` | ✅ | `production` (never exposes reset codes in API responses) |
| `PORT` | ❌ | Set automatically by Render |
| `FRONTEND_URL` | ❌ | Vercel URL(s) for CORS, comma-separated |
| `OPENAI_API_KEY` | ❌ | Enables real AI responses (offline coach otherwise) |
| `OPENAI_MODEL` | ❌ | Defaults to `gpt-4o-mini` |
| `RESEND_API_KEY` | ❌ | Emails password reset codes. With Resend's test sender, mail is only delivered to your own Resend account email unless you verify a domain |

**Frontend (Vercel):**
| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | ✅ | Render backend URL (no trailing slash) |

---

## 📸 Screenshots

### Dashboard
Premium dark theme with stats cards, motivational quotes, and recent workout activity.

### AI Coach
Chat interface with AI-powered fitness advice based on your workout history.

### Workout Tracking
Live workout timer, exercise selection, and set/rep/weight logging with completion tracking.

---

## 🛠️ API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Create account |
| `POST` | `/auth/login` | Login |
| `GET` | `/auth/profile` | Get user profile |
| `PUT` | `/auth/profile` | Update profile (name, height, weight, gender) |
| `POST` | `/auth/forgot-password` | Request password reset |
| `POST` | `/auth/reset-password` | Reset password with email + code |
| `GET` | `/workouts` | Get user workouts |
| `POST` | `/workouts` | Save a workout |
| `DELETE` | `/workouts/:id` | Delete a workout |
| `POST` | `/ai/chat` | Send message to AI coach |
| `GET` | `/ai/history` | Get chat history |
| `DELETE` | `/ai/history` | Clear chat history |
| `POST` | `/summary/weekly` | Generate weekly summary |
| `GET` | `/summary/weekly` | Get past summaries |
| `GET` | `/health` | Health check |

---

## 👨‍💻 Author

**Shivam Tiwari**

---

## 📄 License

This project is for educational purposes.
