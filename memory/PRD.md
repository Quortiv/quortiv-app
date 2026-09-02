# Quortiv — Product Requirements & État réel

## Vision
Quortiv est une application universelle de prise de notes augmentée par IA.
Positionnement **généraliste** : professionnels tous secteurs, équipes, étudiants,
enseignants, créateurs, journalistes, consultants, chercheurs, indépendants, particuliers.
Les usages de santé existent uniquement comme **contexte spécialisé** (un modèle parmi
dix, `is_specialized: true`, jamais mis en avant dans l'onboarding, la marque ou les parcours).

## Identité
- Nom : **Quortiv** (validé par le propriétaire du projet)
- Palette : navy `#1B2333` (structure) + bleu électrique `#2E5BFF` (action)
- Marque rendue en SVG vectoriel (`src/design/Logo.tsx`) : anneau ouvert coupé par une diagonale
- Modes clair **et** sombre, tokens uniquement (`src/design/tokens.ts`)
- Aucune référence à un produit concurrent nulle part dans le dépôt

## Stack
- Frontend : Expo SDK 54 / expo-router / React Native 0.81 / reanimated / keyboard-controller
- Backend : FastAPI modulaire (`backend/app/`), MongoDB (`quortiv_db`)
- IA : Whisper (transcription horodatée), Claude Sonnet 5 (synthèse, traduction, chat,
  diarisation estimée, expansion de requête) via `EMERGENT_LLM_KEY`
- Stockage média : Emergent Object Storage
- Auth : Emergent Google OAuth + mode invité

## Architecture backend
```
backend/
├── server.py                 assemblage FastAPI, index Mongo, seed des modèles
└── app/
    ├── core.py               env, Mongo, object storage
    ├── models.py             schémas Pydantic
    ├── deps.py               résolution de session
    ├── ai.py                 transcription, diarisation, synthèse, traduction, chat
    ├── extract.py            PDF/DOCX/TXT/VTT/SRT/CSV + extraction web
    ├── docgen.py             génération réelle TXT / Markdown / PDF (reportlab)
    ├── notes_service.py      pipeline d'analyse, seed, contexte de note
    ├── templates_seed.py     10 modèles intégrés (généralistes d'abord)
    └── routers/              auth, library, notes, capture, intelligence, exports, insights
```

## Écrans
`onboarding`, `auth/login`, `(tabs)/index` (accueil), `(tabs)/library`,
`(tabs)/insights` (pilotage), `(tabs)/profile`, `notes` (liste + filtres + sélection
multiple), `search` (mot-clé + recherche intelligente), `note/[id]` (4 onglets),
`capture/record`, `capture/text`, `capture/link`, `capture/meeting`,
`templates`, `templates/[id]`, `actions`, `graph`, `assistant`, `shared/[shareId]`.

## Périmètre fonctionnel implémenté
**Capture** : enregistrement micro avec pause/reprise/annulation, transcription par
segments pendant l'enregistrement (chunks de 22 s), import audio, import vidéo
(piste transcrite), import documents avec extraction réelle, saisie/collage de texte,
import depuis URL publique, préparation de réunion en ligne + ingestion du fichier
fourni par la plateforme, gestion complète des permissions micro (granted / denied /
canAskAgain / bloqué + « Ouvrir les réglages »), consentement des participants.

**Transcription** : horodatage par segment, lecteur audio synchronisé (surlignage du
segment courant), recherche dans la transcription, édition manuelle, diarisation
estimée par IA avec renommage des intervenants, traduction (7 langues).

**Synthèse** : résumé Markdown structuré par modèle, points clés, décisions, actions
(responsable + échéance), plan des sujets, aperçu analytique, tags, 3 niveaux de détail
(express / standard / approfondi), régénération avec un autre modèle, mention explicite
du caractère généré, édition de toutes les sorties.

**Organisation** : dossiers CRUD complet (création, renommage, couleur, suppression avec
report des notes), tags, favoris, archives, recherche plein texte, recherche intelligente
(expansion de requête + scoring pondéré), filtres (type, statut, période, dossier, tags),
tri, pagination, actions groupées.

**Assistant** : chat contextuel par note et chat multi-notes, réponses uniquement issues
du contenu, sources citées, suggestions de questions, historique persisté.

**Export & partage** : PDF réel (reportlab), Markdown, TXT, copie presse-papiers,
partage natif, lien public révocable + export public.

**Compte** : Google, invité, préférences persistées (langue, thème, modèle et dossier
par défaut, niveau de synthèse, diarisation, réduction des animations), export complet
des données, suppression définitive du compte.

**Différenciateurs** : tableau de bord analytique (activité, sources, modèles, tags,
complétion des actions), carte des connaissances (clusters de tags), boîte de réception
des actions + rappels, mode hors ligne (cache lecture + file d'attente de captures).

## Limites déclarées
- Transcription **quasi** temps réel (segments de 22 s), pas de streaming continu :
  le mode « transcription en direct » n'archive pas l'audio, le mode continu l'archive
  pour la lecture synchronisée. Choix explicite à l'écran d'enregistrement.
- Diarisation **estimée par IA** à partir du contenu, pas de séparation acoustique.
- Aucun robot n'entre dans les réunions tierces : capture par le micro de l'appareil ou
  ingestion du fichier exporté par la plateforme.
- Import URL limité aux pages publiques et aux fichiers directement accessibles
  (.vtt/.srt/.pdf/.txt) — les plateformes vidéo protègent leurs transcriptions.
- Rappels visibles dans l'application, sans notification système.
- Médias : 25 Mo max (limite Whisper), documents : 15 Mo max.

## Tests
- `backend/tests/test_api_e2e.py` : 48 vérifications de bout en bout sur l'API réelle
  (IA, PDF, partage public, traduction, chat, sécurité inter-utilisateurs, validations).
  Exécution : `python backend/tests/test_api_e2e.py`.
