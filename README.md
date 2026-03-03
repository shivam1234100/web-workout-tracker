# 🏋️ AI Workout Tracker

A full-stack AI-powered workout tracker with personalized coaching, exercise library, and progress analytics.

**🌐 Live Demo:** [web-workout-tracker.vercel.app](https://web-workout-tracker.vercel.app)

---

## ✨ Features

- **🔐 Authentication** — Secure signup, login, and password reset with email verification
- **📊 Dashboard** — Personalized greeting, motivational quotes, workout stats, and recent activity
- **💪 Workout Tracking** — Live timer, exercise selection from 27+ exercises, set/rep/weight logging
- **📚 Exercise Library** — Searchable database with muscle group filters and exercise details
- **📅 Workout History** — View past workouts with detailed breakdowns, delete old entries
- **🤖 AI Coach** — Chat with an AI fitness coach powered by GPT-3.5 Turbo for personalized advice
- **📈 Weekly Insights** — AI-generated weekly summaries with stats and progress analysis
- **👤 Profile** — Manage name, height, weight, and gender
- **📱 Fully Responsive** — Mobile-first design with bottom nav bar and sidebar overlay

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + Vite 6 |
| **Backend** | Express.js + TypeScript |
| **Database** | MongoDB (via Prisma ORM) |
| **AI** | OpenAI GPT-3.5 Turbo |
| **Hosting** | Vercel (frontend) + Render (backend) + MongoDB Atlas (database) |

---

## 📁 Project Structure

```
├── client/                  # React frontend
│   ├── src/
│   │   ├── pages/           # 10 page components
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

# Create .env file
cat > .env << EOF
DATABASE_URL=mongodb+srv://YOUR_USER:YOUR_PASS@cluster.mongodb.net/ai-workout-tracker
JWT_SECRET=your-secret-key
PORT=3000
OPENAI_API_KEY=sk-...        # Optional: enables AI Coach
RESEND_API_KEY=re_...         # Optional: enables email reset
EOF

npx prisma generate
npx tsc
node dist/server.js
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

| Service | Platform | Config |
|---|---|---|
| **Database** | MongoDB Atlas | Free M0 cluster |
| **Backend** | Render | Build: `npm install && npm run build`, Start: `npm start` |
| **Frontend** | Vercel | Auto-detected Vite, env: `VITE_API_URL=https://your-backend.onrender.com` |

### Environment Variables

**Backend (Render):**
| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | JWT signing key |
| `PORT` | ✅ | Server port (3000) |
| `OPENAI_API_KEY` | ❌ | Enables AI Coach (GPT-3.5) |
| `RESEND_API_KEY` | ❌ | Enables email password reset |
| `FRONTEND_URL` | ❌ | Vercel URL for CORS |

**Frontend (Vercel):**
| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | ✅ | Render backend URL |

---

## 📸 Screenshots

### Dashboard
Premium dark theme with stats cards, motivational quotes, and recent workout activity.

### AI Coach
Chat interface with GPT-3.5 powered personalized fitness advice based on your workout history.

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
| `POST` | `/auth/reset-password` | Reset password with code |
| `GET` | `/workouts` | Get user workouts |
| `POST` | `/workouts` | Save a workout |
| `DELETE` | `/workouts/:id` | Delete a workout |
| `POST` | `/ai/chat` | Send message to AI coach |
| `GET` | `/ai/history` | Get chat history |
| `DELETE` | `/ai/history` | Clear chat history |
| `POST` | `/summary/weekly` | Generate weekly summary |
| `GET` | `/summary/weekly` | Get past summaries |

---

## 👨‍💻 Author

**Shivam Tiwari**

---

## 📄 License

This project is for educational purposes.
