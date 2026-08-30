# Bugzilla 2.0 — Next-Gen Intelligent Bug Tracking Platform

**Bugzilla 2.0** is a modernized, high-performance re-imagining of the classic Bugzilla platform. Designed with a sleek **Glassmorphism UI**, real-time event-driven automation, AI-assisted bug triage, multi-channel notifications, and GitHub integration, Bugzilla 2.0 transforms software issue management into an effortless experience.

---

## 🚀 Tech Stack

### **Frontend**
- **Framework**: React 18 with Vite
- **Styling**: Custom Vanilla CSS Design System featuring modern glassmorphism design tokens, CSS variables, sleek dark mode aesthetics, and micro-animations
- **Icons**: Lucide React
- **Routing**: React Router DOM (v6)
- **HTTP Client**: Axios with JWT request interceptors

### **Backend**
- **Framework**: Python 3.14 + FastAPI
- **Database**: Supabase (PostgreSQL client) with an In-Memory Database fallback for local offline testing
- **Async Event Engine**: Background event dispatcher (`dispatcher.py`) for decoupled side-effect execution
- **Integrations**: PyGithub (GitHub REST API & Webhook synchronization), HTTPX (Async Discord/Slack Webhook dispatches)
- **Testing**: Pytest & FastAPI TestClient

### **Artificial Intelligence (AI)**
- **AI Service**: Google Gemini API (`gemini-2.5-flash` / SDK)
- **AI Capabilities**:
  - **Auto-Suggest Fields**: Analyzes title & description to suggest priority, severity, and component
  - **Semantic Duplicate Detection**: Automatically flags potential duplicate bugs during creation
  - **Bug Summarization**: Generates concise status summaries for quick triage

---

## 👥 Roles & Permissions (RBAC)

Bugzilla 2.0 enforces strict Role-Based Access Control (RBAC) across 4 distinct user roles:

| Role | Badge | Key Capabilities |
|---|---|---|
| **Reporter** | 🐞 `reporter` | File new bugs, track reported issues, follow bugs for status updates, receive in-app & email notifications. |
| **Developer** | 💻 `developer` | View assigned tasks, update bug progress (`in_progress`), add technical comments, link GitHub PRs & issues using `Fixes #BUG-<uuid>`. |
| **Tester** | 🧪 `tester` | Perform QA verification, transition bugs from `ready_for_testing` to `verified` or `closed`, run regression workflows. |
| **Admin** | 🛡️ `admin` | System-wide visibility, access the **Automation Rules Engine**, monitor global bug logs, manage system configuration and role permissions. |

---

## ⚡ Key Features

1. **Automation Rules Engine (Admin)**
   - Build custom trigger $\rightarrow$ condition $\rightarrow$ action workflows without writing code.
   - **Supported Triggers**: `bug.created`, `bug.status_changed`, `bug.resolved`, `bug.comment_added`, `bug.assigned`, `bug.updated`.
   - **Operators**: `=`, `!=`, `in`, `contains`.
   - **Actions**: `notify_followers`, `set_status`, `set_priority`, `assign_user`, `send_webhook` (Discord/Slack compatible).

2. **AI-Powered Bug Triage**
   - **Auto-Suggest**: Auto-fills component, priority, and severity based on description analysis.
   - **Duplicate Detection**: Warns reporters if a similar open bug already exists.
   - **AI Summarization**: One-click summary generation for long comment threads.

3. **Multi-Channel Notifications**
   - In-app notification center with real-time unread badges.
   - Email dispatch matrix customizable by relationship (Reporter, Assignee, Follower) and channel.

4. **GitHub Synchronization**
   - Automatic GitHub Issue creation on bug reporting.
   - Synchronizes status when PR descriptions contain `Fixes #BUG-<uuid>`.

---

## 🧪 How to Test Bugzilla 2.0

### **Option 1: Quick Testing via the Web UI (Recommended)**

1. Launch the application (see [Local Setup](#-local-setup-instructions) below).
2. Open your browser and navigate to `http://localhost:5173`.
3. On the authentication page, click **"Sign up"** to create a new user account:
   - Enter a **Full Name**, **Email**, and **Password**.
   - Select your desired **Role** (`Admin`, `Developer`, `Tester`, or `Reporter`).
4. Log in with your new credentials.

> 💡 **Testing Role-Based Views**: You can open multiple browser windows or incognito tabs to log in as different roles simultaneously and test interaction flows (e.g., Reporter files a bug $\rightarrow$ Developer updates status $\rightarrow$ Tester verifies fix).

---

### **Option 2: Using Pre-seeded Accounts & Test Tokens**

The backend pre-populates default demo accounts for instant testing:

| Role | Email | Pre-seeded User ID |
|---|---|---|
| **Admin** | `admin@example.com` | `11111111-1111-1111-1111-111111111103` |
| **Developer** | `developer@example.com` | `11111111-1111-1111-1111-111111111101` |
| **Reporter** | `reporter@example.com` | `11111111-1111-1111-1111-111111111102` |
| **Tester** | `tester@example.com` | `11111111-1111-1111-1111-111111111104` |

*Dev/Test Tokens*: When testing API endpoints directly (via Swagger docs or Postman), you can pass test bearer tokens such as `Authorization: Bearer test-admin-token`, `test-developer-token`, `test-reporter-token`, or `test-tester-token`.

---

## 🛠️ Feature Walkthrough & Test Scenarios

### **Scenario A: Test Automation Rules (Admin Only)**
1. Log in as an **Admin** user.
2. Click **Automation** in the left sidebar nav.
3. Click **"+ New Rule"** and configure:
   - **Name**: *Escalate Critical Safari Bugs*
   - **Trigger**: `Bug Created`
   - **Condition**: `priority` `=` `critical`
   - **Actions**: `Set Status` $\rightarrow$ `in_progress` AND `Send Webhook` $\rightarrow$ *(Enter a Discord webhook URL or mock URL)*
4. Click **Save Rule**.
5. Switch to a **Reporter** account and submit a new bug with `Priority: Critical`.
6. Watch the event dispatcher automatically transition the bug to `in_progress` and log the webhook dispatch in the Admin Execution Log!

---

### **Scenario B: Test AI Auto-Suggest & Duplicate Detection**
1. Log in as a **Reporter**.
2. Click **"Report Bug"** to open the modal.
3. Enter a title like *"Login button unresponsive on Safari 17"* and a description.
4. Click **"AI Suggest Fields"** $\rightarrow$ Watch Gemini AI automatically recommend the component, priority, and severity!
5. Submit the bug. If a similar issue exists, review the AI duplicate candidate alert.

---

### **Scenario C: GitHub PR Synchronization**
1. Create a bug and note its ID / UUID.
2. Open a Pull Request on your linked GitHub repository.
3. Include the text `Fixes #BUG-<uuid>` in the PR description or commit message.
4. When merged, the GitHub Webhook automatically resolves the corresponding bug in Bugzilla 2.0.

---

## 💻 Local Setup Instructions

### **Prerequisites**
- **Node.js** (v18+)
- **Python** (v3.10+)

---

### **1. Backend Setup**

```bash
# Navigate to the backend directory
cd backend

# Create and activate a Python virtual environment
python -m venv .venv

# On Windows PowerShell:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Configure environment variables (.env file)
# SUPABASE_URL, GITHUB_PAT, GEMINI_API_KEY are configured in backend/.env

# Run the FastAPI development server
$env:PYTHONPATH="app" # Windows PowerShell
uvicorn app.main:app --reload --port 8000
```
- API Documentation (Swagger UI): `http://127.0.0.1:8000/docs`
- Health Check: `http://127.0.0.1:8000/`

---

### **2. Frontend Setup**

```bash
# Navigate to the frontend directory
cd frontend

# Install Node dependencies
npm install

# Start the Vite development server
npm run dev
```
- Web Application: `http://localhost:5173`

---

### **3. Running the Test Suite**

```bash
# From the project root directory:
$env:PYTHONPATH="backend"
.venv\Scripts\pytest backend/tests
```

---

## 📄 License

Built for **Clonefest**. All rights reserved.
