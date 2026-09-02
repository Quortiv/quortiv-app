# SmartNoter — AI Medical Note-Taking Assistant

## Vision
Real competitor to SmartNoter with a medical focus (doctor–patient like Doctolib). AI note-taking assistant for medical professionals and general use.

## Core Features (MVP shipped)
- **Live audio recording** (expo-audio) with animated waveform + timer
- **Audio file import** (m4a, mp3, wav, mp4)
- **Whisper transcription** (`whisper-1` via `emergentintegrations` + Emergent LLM Key)
- **AI summarization** (Claude Sonnet 5 via `emergentintegrations`) with structured JSON output: title, summary (Markdown), actions, plan, tags
- **Medical & general templates**: Consultation SOAP, Consultation rapide, Réunion classique, Notes de cours, Analyse approfondie
- **Folders** (multi-color, note counts)
- **Search & filter** (by folder, text, date range, status)
- **Note detail** with tabs: Résumé / Transcription / Actions / Plan
- **Authentication**: Emergent Managed Google Auth + guest mode
- **Multilingual UI**: FR / EN toggle
- **Audio storage**: Emergent Managed Object Storage

## Stack
- Backend: FastAPI + Motor (MongoDB) + emergentintegrations + Emergent Object Storage
- Frontend: Expo SDK 54, Expo Router, react-native-reanimated, expo-audio, expo-document-picker, expo-web-browser
- LLM: `EMERGENT_LLM_KEY` (universal) → OpenAI Whisper + Anthropic Claude Sonnet 5

## Backend API
`/api/auth/session` (Google), `/api/auth/guest`, `/api/auth/me`, `/api/auth/logout`
`/api/folders` (GET/POST/DELETE), `/api/templates` (GET)
`/api/notes` (list), `/api/notes/{id}` (GET/PATCH/DELETE), `/api/notes/upload` (audio), `/api/notes/from-text`, `/api/notes/{id}/audio`
`/api/stats`

## Data Models
- `users`: user_id, email, name, picture
- `user_sessions`: session_token, user_id, expires_at (TTL)
- `folders`: id, user_id, name, color
- `templates`: id, user_id (null=global), name, description, icon, system_prompt, is_medical, is_default
- `notes`: id, user_id, title, folder_id, template_id, template_name, audio_path, duration_sec, language, status, transcription, summary, actions[], plan[], tags[]
