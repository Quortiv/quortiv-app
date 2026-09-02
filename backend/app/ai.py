import json
import re
import uuid
from typing import Any, Dict, List, Optional

from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai.speech_to_text import OpenAISpeechToText

from .core import EMERGENT_LLM_KEY, logger

TEXT_MODEL = ("anthropic", "claude-sonnet-5")
WHISPER_LANGS = {"fr", "en", "es", "de", "it", "pt", "nl", "ar", "ru", "zh", "ja"}

LANG_NAMES = {
    "fr": "français", "en": "anglais", "es": "espagnol", "de": "allemand",
    "it": "italien", "pt": "portugais", "nl": "néerlandais", "ar": "arabe",
    "ru": "russe", "zh": "chinois", "ja": "japonais",
}

LEVEL_HINTS = {
    "brief": "Résumé très court : 3 à 5 phrases maximum, lecture en 30 secondes.",
    "standard": "Résumé structuré et complet, lecture en 2 à 3 minutes.",
    "deep": "Restitution longue et détaillée, lecture en 6 à 10 minutes, avec nuances et citations.",
}


def _chat(system_message: str, session_prefix: str = "quortiv") -> LlmChat:
    return LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"{session_prefix}-{uuid.uuid4().hex[:10]}",
        system_message=system_message,
    ).with_model(*TEXT_MODEL)


def extract_json(text: str) -> dict:
    text = (text or "").strip()
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        text = fence.group(1)
    else:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            text = m.group(0)
    return json.loads(text)


# ---------------------------------------------------------------- transcription
async def transcribe_file(path: str, language: str = "fr") -> Dict[str, Any]:
    """Return {'text': str, 'segments': [{start,end,text}], 'language': str}."""
    stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
    resp = await stt.transcribe(
        file=path,
        model="whisper-1",
        response_format="verbose_json",
        language=language if language in WHISPER_LANGS else None,
    )

    def field(obj, key, default=None):
        if isinstance(obj, dict):
            return obj.get(key, default)
        return getattr(obj, key, default)

    text = field(resp, "text") or ""
    raw_segments = field(resp, "segments") or []
    segments: List[Dict[str, Any]] = []
    for s in raw_segments:
        seg_text = (field(s, "text") or "").strip()
        if not seg_text:
            continue
        segments.append({
            "start": round(float(field(s, "start", 0) or 0), 2),
            "end": round(float(field(s, "end", 0) or 0), 2),
            "text": seg_text,
            "speaker": None,
        })
    if not segments and text:
        segments = [{"start": 0, "end": 0, "text": text.strip(), "speaker": None}]
    return {
        "text": text.strip(),
        "segments": segments,
        "language": field(resp, "language") or language,
        "duration": float(field(resp, "duration", 0) or 0),
    }


# ---------------------------------------------------------------- diarization
DIARIZE_SYSTEM = (
    "Tu es un expert en analyse conversationnelle. On te donne une transcription découpée en segments numérotés. "
    "Ta tâche : estimer quel intervenant prononce chaque segment, en te basant sur les changements de sujet, "
    "les questions/réponses, les adresses directes et les prénoms cités. "
    "Renvoie STRICTEMENT un JSON : {\"speaker_count\": int, "
    "\"labels\": {\"S1\": \"nom ou rôle si explicitement identifiable, sinon 'Intervenant 1'\", ...}, "
    "\"assignments\": {\"0\": \"S1\", \"1\": \"S2\", ...}}. "
    "Si le contenu est manifestement monologue, renvoie speaker_count = 1. "
    "N'invente aucun nom qui n'apparaît pas dans la transcription. Aucun texte hors JSON."
)


async def diarize(segments: List[Dict[str, Any]]) -> Dict[str, Any]:
    """LLM-based speaker attribution (estimation, not acoustic diarization)."""
    if not segments:
        return {"labels": {}, "assignments": {}}
    sample = segments[:400]
    numbered = "\n".join(f"[{i}] {s['text']}" for i, s in enumerate(sample))
    try:
        resp = await _chat(DIARIZE_SYSTEM, "diarize").send_message(UserMessage(text=numbered[:60000]))
        data = extract_json(resp)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"diarization failed: {e}")
        return {"labels": {}, "assignments": {}}
    labels = data.get("labels") or {}
    assignments = data.get("assignments") or {}
    if int(data.get("speaker_count") or 0) <= 1:
        return {"labels": {}, "assignments": {}}
    return {"labels": labels, "assignments": assignments}


def apply_diarization(segments: List[Dict[str, Any]], diar: Dict[str, Any]) -> List[Dict[str, Any]]:
    assignments = diar.get("assignments") or {}
    if not assignments:
        return segments
    last = None
    for i, seg in enumerate(segments):
        spk = assignments.get(str(i)) or last
        seg["speaker"] = spk
        last = spk or last
    return segments


# ---------------------------------------------------------------- summarization
BASE_SYSTEM = (
    "Tu es Quortiv, un assistant de restitution de contenu de niveau professionnel. "
    "Tu produis des restitutions fidèles, structurées et exploitables à partir de transcriptions, "
    "documents ou textes fournis par l'utilisateur.\n\n"
    "RÈGLES ABSOLUES :\n"
    "- Tu ne t'appuies QUE sur le contenu fourni. Tu n'ajoutes aucune information extérieure.\n"
    "- Si une information est absente, tu l'omets plutôt que de l'inventer.\n"
    "- Tu conserves les chiffres, noms propres, dates et montants exactement tels qu'ils apparaissent.\n"
    "- Tu n'attribues une action ou une décision à une personne que si son nom est explicitement cité.\n"
    "- Tu réponds STRICTEMENT en JSON valide, sans aucun texte avant ou après, sans bloc de code.\n\n"
    "SCHÉMA JSON ATTENDU :\n"
    "{\n"
    '  "title": "titre court et descriptif, 60 caractères max",\n'
    '  "summary": "restitution en Markdown, avec des titres de section ## et des listes",\n'
    '  "key_points": ["point clé factuel", "..."],\n'
    '  "decisions": ["décision explicitement prise", "..."],\n'
    '  "actions": [{"text": "action concrète", "owner": "nom cité ou null", "due_date": "AAAA-MM-JJ ou null"}],\n'
    '  "plan": ["sujet ou chapitre abordé, dans l\'ordre", "..."],\n'
    '  "insights": "analyse en Markdown : enjeux, tensions, angles morts, ce qui n\'a pas été dit",\n'
    '  "tags": ["3 à 6 mots-clés en minuscules"]\n'
    "}\n"
    "Les listes vides sont autorisées. N'invente jamais de contenu pour remplir un champ."
)


def build_system_prompt(template: Optional[dict], language: str, level: str) -> str:
    parts = [BASE_SYSTEM]
    if template:
        focus = template.get("focus") or ""
        sections = template.get("sections") or []
        parts.append(
            f"\nCONTEXTE DE RESTITUTION — « {template.get('name')} » :\n{focus}"
        )
        if sections:
            parts.append(
                "Le champ \"summary\" doit contenir ces sections Markdown dans cet ordre : "
                + ", ".join(f"## {s}" for s in sections)
            )
    parts.append(f"\nNIVEAU DE DÉTAIL : {LEVEL_HINTS.get(level, LEVEL_HINTS['standard'])}")
    parts.append(f"\nLANGUE DE SORTIE : {LANG_NAMES.get(language, 'français')}. Toutes les valeurs textuelles doivent être dans cette langue.")
    return "\n".join(parts)


EMPTY_RESULT = {
    "title": "", "summary": "", "key_points": [], "decisions": [],
    "actions": [], "plan": [], "insights": "", "tags": [],
}


async def summarize(content: str, template: Optional[dict], language: str = "fr",
                    level: str = "standard", source_hint: str = "") -> Dict[str, Any]:
    system = build_system_prompt(template, language, level)
    header = f"Type de source : {source_hint}\n\n" if source_hint else ""
    payload = content[:180000]
    msg = UserMessage(text=f"{header}Contenu à restituer :\n\"\"\"\n{payload}\n\"\"\"")
    resp = await _chat(system, "summary").send_message(msg)
    try:
        data = extract_json(resp)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"summary JSON parse failed: {e}")
        data = dict(EMPTY_RESULT, summary=resp.strip())
    out = dict(EMPTY_RESULT)
    out.update({k: v for k, v in data.items() if k in EMPTY_RESULT and v is not None})
    # normalise actions
    norm_actions = []
    for a in out["actions"] or []:
        if isinstance(a, str):
            norm_actions.append({"text": a, "owner": None, "due_date": None})
        elif isinstance(a, dict) and a.get("text"):
            norm_actions.append({
                "text": str(a["text"]),
                "owner": a.get("owner") or None,
                "due_date": a.get("due_date") or None,
            })
    out["actions"] = norm_actions
    out["tags"] = [str(t).strip().lower() for t in (out["tags"] or []) if str(t).strip()][:8]
    for k in ("key_points", "decisions", "plan"):
        out[k] = [str(x).strip() for x in (out[k] or []) if str(x).strip()]
    return out


# ---------------------------------------------------------------- translation
async def translate_text(text: str, target_lang: str) -> str:
    if not text.strip():
        return ""
    system = (
        f"Tu es un traducteur professionnel. Traduis fidèlement le contenu vers le {LANG_NAMES.get(target_lang, target_lang)}. "
        "Conserve rigoureusement la structure Markdown, les listes, les titres, les noms propres, les chiffres et les dates. "
        "Ne commente pas, ne résume pas : renvoie uniquement la traduction."
    )
    return (await _chat(system, "translate").send_message(UserMessage(text=text[:120000]))).strip()


# ---------------------------------------------------------------- note chat
CHAT_SYSTEM = (
    "Tu es Quortiv, l'assistant conversationnel adossé aux notes de l'utilisateur.\n"
    "Tu réponds EXCLUSIVEMENT à partir des extraits de notes fournis dans le contexte.\n"
    "- Si la réponse ne figure pas dans le contexte, dis-le explicitement et n'invente rien.\n"
    "- Cite systématiquement tes sources en fin de réponse sous la forme : Sources : [Titre de la note].\n"
    "- Si tu n'es pas certain, indique ton niveau de certitude.\n"
    "- Sois concis, factuel et directement utile. Utilise le Markdown pour structurer."
)


async def ask_notes(question: str, contexts: List[Dict[str, str]], history: List[Dict[str, str]],
                    language: str = "fr") -> str:
    ctx_blocks = []
    for c in contexts:
        ctx_blocks.append(f"### Note « {c['title']} » (id: {c['id']})\n{c['content'][:40000]}")
    context = "\n\n".join(ctx_blocks) or "(aucune note disponible)"
    hist = "\n".join(
        f"{'Utilisateur' if m['role'] == 'user' else 'Assistant'} : {m['content']}"
        for m in history[-8:]
    )
    system = CHAT_SYSTEM + f"\nLangue de réponse : {LANG_NAMES.get(language, 'français')}."
    text = (
        f"CONTEXTE DISPONIBLE :\n{context}\n\n"
        + (f"HISTORIQUE :\n{hist}\n\n" if hist else "")
        + f"QUESTION :\n{question}"
    )
    return (await _chat(system, "notechat").send_message(UserMessage(text=text))).strip()


# ---------------------------------------------------------------- suggestions
EXPAND_SYSTEM = (
    "Tu enrichis une requête de recherche pour un moteur interne de notes. "
    "Renvoie STRICTEMENT un JSON : {\"terms\": [\"terme\", \"synonyme\", \"reformulation\"]} "
    "avec 4 à 8 termes en minuscules, incluant la requête d'origine et ses variantes utiles. "
    "Aucun texte hors JSON."
)


async def expand_query(query: str) -> List[str]:
    resp = await _chat(EXPAND_SYSTEM, "expand").send_message(UserMessage(text=query))
    return [str(t).lower().strip() for t in (extract_json(resp).get("terms") or []) if str(t).strip()]


async def suggest_questions(title: str, summary: str, language: str = "fr") -> List[str]:
    system = (
        "Propose 3 questions courtes, utiles et concrètes qu'un utilisateur pourrait poser sur cette note. "
        "Renvoie STRICTEMENT un JSON : {\"questions\": [\"...\", \"...\", \"...\"]}. "
        f"Langue : {LANG_NAMES.get(language, 'français')}."
    )
    try:
        resp = await _chat(system, "suggest").send_message(
            UserMessage(text=f"Titre : {title}\n\nRésumé :\n{summary[:8000]}")
        )
        return [str(q) for q in (extract_json(resp).get("questions") or [])][:3]
    except Exception:  # noqa: BLE001
        return []
