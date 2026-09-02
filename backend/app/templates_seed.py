"""Built-in restitution templates. Generalist first; specialised contexts are opt-in."""

BUILTIN_TEMPLATES = [
    {
        "name": "Réunion d'équipe",
        "description": "Points clés, décisions et actions assignées",
        "icon": "people-outline",
        "category": "work",
        "sort_order": 10,
        "sections": ["Contexte", "Points clés", "Décisions", "Prochaines étapes"],
        "focus": (
            "Restitue une réunion professionnelle. Mets en avant le contexte, les points discutés, "
            "les décisions arrêtées, les désaccords éventuels et les prochaines étapes. "
            "Attribue chaque action à la personne nommée dans la transcription lorsque c'est explicite."
        ),
    },
    {
        "name": "Note générale",
        "description": "Synthèse claire et neutre de n'importe quel contenu",
        "icon": "document-text-outline",
        "category": "general",
        "sort_order": 20,
        "sections": ["Résumé", "Points clés", "À retenir"],
        "focus": (
            "Restitue un contenu quelconque de façon claire, neutre et structurée. "
            "Va à l'essentiel, conserve les chiffres, noms et dates cités."
        ),
    },
    {
        "name": "Cours & étude",
        "description": "Plan du cours, concepts et fiches de révision",
        "icon": "school-outline",
        "category": "education",
        "sort_order": 30,
        "sections": ["Plan du cours", "Concepts clés", "Définitions", "À réviser"],
        "focus": (
            "Restitue un contenu pédagogique. Dégage le plan du cours, les concepts et définitions, "
            "les exemples donnés, et propose une liste de points à réviser."
        ),
    },
    {
        "name": "Appel commercial",
        "description": "Besoins client, objections et prochaines étapes",
        "icon": "trending-up-outline",
        "category": "sales",
        "sort_order": 40,
        "sections": ["Contexte client", "Besoins", "Objections", "Budget & calendrier", "Prochaines étapes"],
        "focus": (
            "Restitue un échange commercial. Identifie l'entreprise et les interlocuteurs, les besoins exprimés, "
            "les objections, le budget et le calendrier évoqués, le niveau d'intérêt et les prochaines étapes concrètes."
        ),
    },
    {
        "name": "Entretien de recrutement",
        "description": "Parcours, compétences et évaluation structurée",
        "icon": "person-outline",
        "category": "hr",
        "sort_order": 50,
        "sections": ["Profil", "Parcours", "Compétences", "Points de vigilance", "Recommandation"],
        "focus": (
            "Restitue un entretien de recrutement de façon factuelle et non discriminatoire. "
            "Résume le parcours, les compétences démontrées avec exemples, les points à approfondir "
            "et une recommandation argumentée. N'invente aucune information personnelle."
        ),
    },
    {
        "name": "Interview & recherche",
        "description": "Verbatims, thèmes et citations exploitables",
        "icon": "mic-outline",
        "category": "research",
        "sort_order": 60,
        "sections": ["Sujet", "Thèmes", "Citations marquantes", "Questions ouvertes"],
        "focus": (
            "Restitue une interview ou un entretien de recherche. Dégage les thèmes, cite fidèlement "
            "les passages marquants entre guillemets, et liste les questions restées ouvertes."
        ),
    },
    {
        "name": "Analyse approfondie",
        "description": "Argumentation, angles morts et recommandations",
        "icon": "analytics-outline",
        "category": "research",
        "sort_order": 70,
        "sections": ["Contexte", "Analyse", "Angles morts", "Recommandations"],
        "focus": (
            "Produis une analyse approfondie du contenu : structure argumentative, hypothèses implicites, "
            "angles morts, risques, et recommandations concrètes hiérarchisées."
        ),
    },
    {
        "name": "Brainstorming",
        "description": "Idées regroupées par thème et pistes à creuser",
        "icon": "bulb-outline",
        "category": "creative",
        "sort_order": 80,
        "sections": ["Idées par thème", "Pistes fortes", "À explorer"],
        "focus": (
            "Restitue une session d'idéation. Regroupe les idées par thème, distingue les pistes fortes "
            "des pistes secondaires, et propose les prochaines explorations."
        ),
    },
    {
        "name": "Journal personnel",
        "description": "Faits, ressentis et intentions pour la suite",
        "icon": "journal-outline",
        "category": "personal",
        "sort_order": 90,
        "sections": ["Faits", "Ressentis", "Intentions"],
        "focus": (
            "Restitue une note personnelle avec bienveillance : les faits rapportés, les ressentis exprimés "
            "et les intentions pour la suite. Ne juge pas, n'ajoute pas de conseil non demandé."
        ),
    },
    {
        "name": "Suivi de santé",
        "description": "Contexte spécialisé — synthèse structurée d'un échange de suivi",
        "icon": "pulse-outline",
        "category": "specialized",
        "is_specialized": True,
        "sort_order": 200,
        "sections": ["Éléments rapportés", "Observations", "Analyse", "Suivi proposé"],
        "focus": (
            "Restitue un échange de suivi de santé de façon strictement factuelle : éléments rapportés par la personne, "
            "observations mentionnées, analyse évoquée pendant l'échange et suivi proposé. "
            "N'émets JAMAIS de diagnostic, de prescription ni de conseil médical de ta propre initiative : "
            "reprends uniquement ce qui a été dit. Rappelle en fin de résumé que cette synthèse ne remplace pas un avis professionnel."
        ),
    },
]
