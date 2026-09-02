"""Real file generation for exports: TXT, Markdown, PDF."""
import io
import re
from datetime import datetime
from typing import Any, Dict, List

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (ListFlowable, ListItem, PageBreak, Paragraph,
                                SimpleDocTemplate, Spacer)

NAVY = colors.HexColor("#1B2333")
BLUE = colors.HexColor("#2E5BFF")
GREY = colors.HexColor("#64748B")


def _fmt_duration(sec: int) -> str:
    sec = int(sec or 0)
    h, m, s = sec // 3600, (sec % 3600) // 60, sec % 60
    return f"{h}h{m:02d}m" if h else (f"{m}m{s:02d}s" if m else f"{s}s")


def _fmt_ts(sec: float) -> str:
    sec = int(sec or 0)
    return f"{sec // 60:02d}:{sec % 60:02d}"


def _meta_line(note: Dict[str, Any]) -> str:
    created = note.get("created_at")
    if isinstance(created, datetime):
        created = created.strftime("%d/%m/%Y %H:%M")
    bits = [str(created or "")]
    if note.get("template_name"):
        bits.append(note["template_name"])
    if note.get("duration_sec"):
        bits.append(_fmt_duration(note["duration_sec"]))
    return "  ·  ".join(b for b in bits if b)


def build_markdown(note: Dict[str, Any]) -> str:
    lines: List[str] = [f"# {note.get('title') or 'Note'}", "", f"_{_meta_line(note)}_", ""]
    if note.get("tags"):
        lines += ["**Tags :** " + ", ".join(f"`{t}`" for t in note["tags"]), ""]
    if note.get("summary"):
        lines += ["## Restitution", "", note["summary"], ""]
    if note.get("key_points"):
        lines += ["## Points clés", ""] + [f"- {p}" for p in note["key_points"]] + [""]
    if note.get("decisions"):
        lines += ["## Décisions", ""] + [f"- {d}" for d in note["decisions"]] + [""]
    if note.get("actions"):
        lines += ["## Actions", ""]
        for a in note["actions"]:
            suffix = []
            if a.get("owner"):
                suffix.append(a["owner"])
            if a.get("due_date"):
                suffix.append(a["due_date"])
            tail = f" _({' — '.join(suffix)})_" if suffix else ""
            lines.append(f"- [{'x' if a.get('done') else ' '}] {a.get('text','')}{tail}")
        lines.append("")
    if note.get("plan"):
        lines += ["## Sujets abordés", ""] + [f"{i+1}. {p}" for i, p in enumerate(note["plan"])] + [""]
    if note.get("insights"):
        lines += ["## Aperçu analytique", "", note["insights"], ""]
    segments = note.get("segments") or []
    if segments:
        lines += ["## Transcription", ""]
        for s in segments:
            speaker = note.get("speakers", {}).get(s.get("speaker") or "", s.get("speaker") or "")
            prefix = f"**[{_fmt_ts(s.get('start', 0))}]**"
            if speaker:
                prefix += f" **{speaker} :**"
            lines.append(f"{prefix} {s.get('text','')}")
            lines.append("")
    elif note.get("transcription"):
        lines += ["## Transcription", "", note["transcription"], ""]
    lines += ["---", "", "_Restitution générée automatiquement avec Quortiv — à vérifier avant diffusion._"]
    return "\n".join(lines)


def build_text(note: Dict[str, Any]) -> str:
    md = build_markdown(note)
    md = re.sub(r"^#{1,6}\s*", "", md, flags=re.MULTILINE)
    md = md.replace("**", "").replace("`", "").replace("_", "")
    return md


_INLINE = [
    (re.compile(r"\*\*(.+?)\*\*"), r"<b>\1</b>"),
    (re.compile(r"(?<!\w)\*(?!\s)(.+?)(?<!\s)\*(?!\w)"), r"<i>\1</i>"),
    (re.compile(r"`(.+?)`"), r"<font face='Courier'>\1</font>"),
]


def _inline(text: str) -> str:
    text = (text or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    for pattern, repl in _INLINE:
        text = pattern.sub(repl, text)
    return text


def build_pdf(note: Dict[str, Any], include_transcript: bool = True) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm, bottomMargin=18 * mm,
        title=note.get("title") or "Note Quortiv", author="Quortiv",
    )
    ss = getSampleStyleSheet()
    st_title = ParagraphStyle("QTitle", parent=ss["Title"], fontSize=21, leading=26,
                              textColor=NAVY, alignment=TA_LEFT, spaceAfter=4)
    st_meta = ParagraphStyle("QMeta", parent=ss["Normal"], fontSize=9, leading=13,
                             textColor=GREY, spaceAfter=14)
    st_h2 = ParagraphStyle("QH2", parent=ss["Heading2"], fontSize=13.5, leading=18,
                           textColor=BLUE, spaceBefore=14, spaceAfter=6)
    st_h3 = ParagraphStyle("QH3", parent=ss["Heading3"], fontSize=11.5, leading=15,
                           textColor=NAVY, spaceBefore=10, spaceAfter=4)
    st_body = ParagraphStyle("QBody", parent=ss["BodyText"], fontSize=10.5, leading=15.5,
                             textColor=colors.HexColor("#1F2937"), spaceAfter=6)
    st_small = ParagraphStyle("QSmall", parent=st_body, fontSize=9, leading=13, textColor=GREY)

    flow: List[Any] = [Paragraph(_inline(note.get("title") or "Note"), st_title),
                       Paragraph(_inline(_meta_line(note)), st_meta)]

    def render_markdown(md: str):
        bullets: List[str] = []

        def flush():
            nonlocal bullets
            if bullets:
                flow.append(ListFlowable(
                    [ListItem(Paragraph(_inline(b), st_body), leftIndent=12) for b in bullets],
                    bulletType="bullet", bulletColor=BLUE, start="circle", leftIndent=14,
                ))
                flow.append(Spacer(1, 4))
                bullets = []

        for raw in (md or "").split("\n"):
            line = raw.rstrip()
            if not line.strip():
                flush()
                continue
            if line.startswith("### "):
                flush(); flow.append(Paragraph(_inline(line[4:]), st_h3)); continue
            if line.startswith("## "):
                flush(); flow.append(Paragraph(_inline(line[3:]), st_h2)); continue
            if line.startswith("# "):
                flush(); flow.append(Paragraph(_inline(line[2:]), st_h2)); continue
            m = re.match(r"^\s*[-*+]\s+(.*)$", line)
            if m:
                bullets.append(m.group(1)); continue
            m = re.match(r"^\s*\d+[.)]\s+(.*)$", line)
            if m:
                bullets.append(m.group(1)); continue
            flush()
            flow.append(Paragraph(_inline(line), st_body))
        flush()

    if note.get("tags"):
        flow.append(Paragraph("Tags : " + ", ".join(note["tags"]), st_small))
    if note.get("summary"):
        flow.append(Paragraph("Restitution", st_h2))
        render_markdown(note["summary"])
    for label, key in (("Points clés", "key_points"), ("Décisions", "decisions")):
        if note.get(key):
            flow.append(Paragraph(label, st_h2))
            render_markdown("\n".join(f"- {x}" for x in note[key]))
    if note.get("actions"):
        flow.append(Paragraph("Actions", st_h2))
        rows = []
        for a in note["actions"]:
            suffix = " — ".join(x for x in [a.get("owner"), a.get("due_date")] if x)
            mark = "[x]" if a.get("done") else "[ ]"
            rows.append(f"- {mark} {a.get('text','')}" + (f" ({suffix})" if suffix else ""))
        render_markdown("\n".join(rows))
    if note.get("plan"):
        flow.append(Paragraph("Sujets abordés", st_h2))
        render_markdown("\n".join(f"{i+1}. {p}" for i, p in enumerate(note["plan"])))
    if note.get("insights"):
        flow.append(Paragraph("Aperçu analytique", st_h2))
        render_markdown(note["insights"])

    segments = note.get("segments") or []
    if include_transcript and (segments or note.get("transcription")):
        flow.append(PageBreak())
        flow.append(Paragraph("Transcription", st_h2))
        if segments:
            for s in segments:
                speaker = note.get("speakers", {}).get(s.get("speaker") or "", s.get("speaker") or "")
                head = f"[{_fmt_ts(s.get('start', 0))}]"
                if speaker:
                    head += f" {speaker} :"
                flow.append(Paragraph(f"<b>{_inline(head)}</b> {_inline(s.get('text',''))}", st_body))
        else:
            render_markdown(note["transcription"])

    flow.append(Spacer(1, 14))
    flow.append(Paragraph(
        "Restitution générée automatiquement avec Quortiv — à vérifier avant diffusion.", st_small))
    doc.build(flow)
    return buf.getvalue()
