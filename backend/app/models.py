import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


SOURCE_TYPES = {"recording", "audio", "video", "document", "text", "url", "meeting"}


class UserPrefs(BaseModel):
    language: str = "fr"
    theme: str = "system"  # system | light | dark
    default_template_id: Optional[str] = None
    default_folder_id: Optional[str] = None
    summary_level: str = "standard"  # brief | standard | deep
    recording_consent_ack: bool = False
    diarization: bool = True
    reduce_motion: bool = False


class User(BaseModel):
    user_id: str
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None
    is_guest: bool = False
    prefs: UserPrefs = Field(default_factory=UserPrefs)
    created_at: datetime = Field(default_factory=now_utc)


class Folder(BaseModel):
    id: str = Field(default_factory=new_id)
    user_id: str
    name: str
    color: str = "#2E5BFF"
    icon: str = "folder-outline"
    created_at: datetime = Field(default_factory=now_utc)


class FolderCreate(BaseModel):
    name: str
    color: Optional[str] = "#2E5BFF"
    icon: Optional[str] = "folder-outline"


class FolderUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None


class Template(BaseModel):
    id: str = Field(default_factory=new_id)
    user_id: Optional[str] = None  # None = built-in
    name: str
    description: str
    icon: str = "document-text-outline"
    category: str = "general"
    focus: str = ""
    sections: List[str] = []
    is_specialized: bool = False
    is_builtin: bool = False
    sort_order: int = 100
    created_at: datetime = Field(default_factory=now_utc)


class TemplateCreate(BaseModel):
    name: str
    description: str = ""
    icon: str = "document-text-outline"
    category: str = "custom"
    focus: str
    sections: List[str] = []


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    focus: Optional[str] = None
    sections: Optional[List[str]] = None


class ActionItem(BaseModel):
    id: str = Field(default_factory=new_id)
    text: str
    owner: Optional[str] = None
    due_date: Optional[str] = None
    done: bool = False


class Segment(BaseModel):
    start: float = 0
    end: float = 0
    text: str = ""
    speaker: Optional[str] = None


class Note(BaseModel):
    id: str = Field(default_factory=new_id)
    user_id: str
    title: str
    folder_id: Optional[str] = None
    template_id: Optional[str] = None
    template_name: Optional[str] = None
    source_type: str = "recording"
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    audio_path: Optional[str] = None
    media_mime: Optional[str] = None
    duration_sec: int = 0
    language: str = "fr"
    status: str = "processing"  # processing | ready | failed
    error: Optional[str] = None
    transcription: str = ""
    segments: List[Segment] = []
    speakers: Dict[str, str] = {}
    summary: str = ""
    summary_level: str = "standard"
    key_points: List[str] = []
    decisions: List[str] = []
    actions: List[ActionItem] = []
    plan: List[str] = []
    insights: str = ""
    tags: List[str] = []
    translations: Dict[str, Any] = {}
    favorite: bool = False
    archived: bool = False
    share_id: Optional[str] = None
    word_count: int = 0
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    folder_id: Optional[str] = None
    summary: Optional[str] = None
    transcription: Optional[str] = None
    insights: Optional[str] = None
    key_points: Optional[List[str]] = None
    decisions: Optional[List[str]] = None
    plan: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    actions: Optional[List[ActionItem]] = None
    segments: Optional[List[Segment]] = None
    speakers: Optional[Dict[str, str]] = None
    favorite: Optional[bool] = None
    archived: Optional[bool] = None
    language: Optional[str] = None


class TextNoteCreate(BaseModel):
    text: str
    title: Optional[str] = None
    folder_id: Optional[str] = None
    template_id: Optional[str] = None
    language: str = "fr"
    source_type: str = "text"
    analyze: bool = True


class UrlNoteCreate(BaseModel):
    url: str
    title: Optional[str] = None
    folder_id: Optional[str] = None
    template_id: Optional[str] = None
    language: str = "fr"


class DraftCreate(BaseModel):
    title: Optional[str] = None
    folder_id: Optional[str] = None
    template_id: Optional[str] = None
    language: str = "fr"


class ReprocessRequest(BaseModel):
    template_id: Optional[str] = None
    summary_level: Optional[str] = None
    language: Optional[str] = None


class TranslateRequest(BaseModel):
    target_lang: str
    scope: str = "summary"  # summary | transcription | both


class ChatRequest(BaseModel):
    message: str
    note_ids: Optional[List[str]] = None


class SessionRequest(BaseModel):
    session_id: str


class PrefsUpdate(BaseModel):
    language: Optional[str] = None
    theme: Optional[str] = None
    default_template_id: Optional[str] = None
    default_folder_id: Optional[str] = None
    summary_level: Optional[str] = None
    recording_consent_ack: Optional[bool] = None
    diarization: Optional[bool] = None
    reduce_motion: Optional[bool] = None
    name: Optional[str] = None


class Reminder(BaseModel):
    id: str = Field(default_factory=new_id)
    user_id: str
    note_id: Optional[str] = None
    note_title: Optional[str] = None
    action_id: Optional[str] = None
    text: str
    due_at: Optional[str] = None
    done: bool = False
    created_at: datetime = Field(default_factory=now_utc)


class ReminderCreate(BaseModel):
    text: str
    note_id: Optional[str] = None
    action_id: Optional[str] = None
    due_at: Optional[str] = None


class ReminderUpdate(BaseModel):
    text: Optional[str] = None
    due_at: Optional[str] = None
    done: Optional[bool] = None
