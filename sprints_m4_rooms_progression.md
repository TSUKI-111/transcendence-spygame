# M4 --- Rooms & Progression

## Plan de sprints hebdomadaires --- ft_transcendence: Spy Game

> **Objectif du document :** me rappeler quoi faire chaque semaine,
> garder une progression visible et continuer à avancer même si les
> autres modules ne sont pas encore terminés.

------------------------------------------------------------------------

## Mon contexte actuel

-   [x] Dépôt cloné et branche `main` synchronisée au dernier contrôle.
-   [x] Docker Compose démarre les quatre services.
-   [x] `GET /health` répond `{"status":"ok"}`.
-   [x] `GET /ready` confirme la connexion PostgreSQL.
-   [x] La migration `20261003130832_foundation_test` est appliquée.
-   [x] Le schéma Prisma contient actuellement `FoundationTest`.
-   [ ] Confirmer avec M2 le modèle `User` et le type de son
    identifiant.
-   [ ] Confirmer avec M1 le contrat de démarrage d'une partie et le
    lien éventuel entre `Room` et `Game`.

**Important :** le schéma métier Rooms n'a pas encore été créé. Ne pas
inventer le modèle `User`, ne pas créer un système d'authentification
parallèle et ne pas lancer de migration partagée avant d'avoir vérifié
les contrats et la stratégie Git de l'équipe.

------------------------------------------------------------------------

## Ma méthode de travail

Chaque sprint dure une semaine. Je vise un résultat démontrable, pas
seulement du code écrit.

Pour chaque tâche : 1. Comprendre le résultat attendu. 2. Faire une
petite modification. 3. Tester cette modification. 4. Noter ce que j'ai
appris et ce qui bloque. 5. Faire un commit sur ma branche de
fonctionnalité lorsque le changement est cohérent et testé.

### Trois catégories de tâches

-   **READY --- indépendante :** je peux avancer sans attendre les
    autres.
-   **BLOCKED --- bloquée :** une réponse, un contrat ou une décision
    d'équipe est nécessaire.
-   **INTEGRATION --- intégration :** je relie mon travail au module
    d'un coéquipier quand son contrat est disponible.

Quand une tâche est bloquée, je la note et je passe à une tâche
indépendante. Je ne reste pas bloqué toute la journée.

------------------------------------------------------------------------

# Sprint 1 --- Préparation et conception des Rooms

**Objectif :** disposer d'un plan de conception clair et d'un
environnement de développement vérifié.

### Tâches

-   [x] Vérifier que Docker Compose démarre.
-   [x] Vérifier `/health` et `/ready`.
-   [x] Examiner le schéma Prisma et la migration initiale.
-   [ ] Vérifier la stratégie de branches Git avec l'équipe.
-   [ ] Demander à M2 le nom du modèle utilisateur et le type de son
    identifiant.
-   [ ] Demander à M1 comment le démarrage d'une partie sera déclenché
    et identifié.
-   [ ] Définir les champs de `Room` et `RoomPlayer` sans encore
    appliquer de migration.
-   [ ] Écrire les règles métier et les cas de test attendus.

### Règles métier à conserver

-   Capacité configurable de 3 à 8 joueurs ; 8 par défaut.
-   Un salon plein refuse les nouveaux joueurs.
-   Un salon privé possède un code d'invitation généré côté serveur.
-   Le code d'invitation ne doit pas apparaître dans la liste publique
    des salons.
-   Un utilisateur non autorisé ne doit pas pouvoir découvrir
    l'existence d'un salon privé par un accès direct.
-   L'hôte est transféré au premier joueur restant lorsqu'il quitte le
    salon.
-   Si le dernier joueur quitte le salon, le salon et ses associations
    sont supprimés.
-   Seul l'hôte peut démarrer une partie, et uniquement si au moins 3
    joueurs sont présents et que le salon est dans un état compatible.

### Definition of Done

-   [ ] Les décisions et dépendances sont documentées.
-   [ ] Les contrats M1/M2 sont confirmés ou clairement marqués comme
    bloqués.
-   [ ] Aucun changement de schéma partagé n'est fait sur la base d'une
    hypothèse.

------------------------------------------------------------------------

# Sprint 2 --- Modèles de données et API de base

**Objectif :** construire le socle Rooms sans dépendre de l'interface
finale.

### READY --- tâches indépendantes

-   [ ] Concevoir les modèles Prisma après confirmation des identifiants
    et relations.
-   [ ] Préparer une migration additive et examiner son SQL avant
    application.
-   [ ] Créer `RoomsModule`, `RoomsService` et `RoomsController`.
-   [ ] Implémenter la création d'un salon.
-   [ ] Implémenter la liste des salons publics sans codes privés.
-   [ ] Implémenter les validations de capacité et de statut.
-   [ ] Écrire des tests unitaires pour les règles métier.

### BLOCKED / INTEGRATION

-   [ ] Relier les salons au véritable modèle `User` fourni par M2.
-   [ ] Confirmer comment l'authentification transmet l'identité au
    backend.

### Endpoints envisagés --- à valider avant implémentation

-   `POST /rooms`
-   `GET /rooms`
-   `GET /rooms/:id`

### Definition of Done

-   [ ] Les modèles sont compatibles avec le schéma partagé.
-   [ ] La migration est revue et appliquée sans réinitialiser la base.
-   [ ] Les routes principales et les validations ont des tests.
-   [ ] Les erreurs sont cohérentes et ne révèlent pas de données
    privées.

------------------------------------------------------------------------

# Sprint 3 --- Rejoindre, quitter et gérer les invitations

**Objectif :** rendre le cycle de vie d'un salon fiable.

### READY --- tâches indépendantes

-   [ ] Implémenter les règles de rejoindre/quitter avec des tests.
-   [ ] Refuser les salons pleins ou non joignables.
-   [ ] Empêcher les associations dupliquées entre joueur et salon.
-   [ ] Gérer le transfert de l'hôte.
-   [ ] Supprimer le salon lorsque le dernier joueur part.
-   [ ] Ajouter des tests pour les erreurs et les cas limites.

### BLOCKED / INTEGRATION

-   [ ] Vérifier l'autorisation de chaque opération avec
    l'authentification M2.
-   [ ] Vérifier que les transactions et contraintes de base évitent les
    courses concurrentes.
-   [ ] Finaliser le mécanisme de code d'invitation et ses protections
    contre les essais répétés.

### Endpoints envisagés --- à valider avant implémentation

-   `POST /rooms/:id/join` --- salon public.
-   `POST /rooms/join-by-invite` --- salon privé.
-   `POST /rooms/:id/leave` --- quitter un salon.

### Definition of Done

-   [ ] Les scénarios de succès et d'échec sont testés.
-   [ ] Un accès non autorisé à un salon privé ne révèle pas son
    existence.
-   [ ] Le transfert de l'hôte et la suppression du salon fonctionnent.

------------------------------------------------------------------------

# Sprint 4 --- Lobby frontend et intégration backend

**Objectif :** permettre à l'utilisateur de voir et gérer un salon dans
l'interface.

### READY --- tâches indépendantes

-   [ ] Créer les composants React du lobby avec des données fictives.
-   [ ] Afficher le nom du salon, les joueurs, la capacité et le statut.
-   [ ] Préparer les états de chargement, erreur et salon plein.
-   [ ] Ajouter les contrôles visuels pour créer, rejoindre et quitter.
-   [ ] Tester l'interface avec des données de démonstration.

### INTEGRATION

-   [ ] Connecter l'interface aux véritables endpoints Rooms.
-   [ ] Remplacer les données fictives par les réponses API.
-   [ ] Vérifier les erreurs et les accès privés.
-   [ ] Intégrer les mises à jour temps réel avec M3 lorsque le contrat
    est disponible.

### Definition of Done

-   [ ] Le parcours principal du lobby est utilisable.
-   [ ] L'interface reflète les erreurs du backend.
-   [ ] Aucun contrôle d'interface ne remplace une validation côté
    serveur.

------------------------------------------------------------------------

# Sprint 5 --- Démarrage de partie et intégration M1/M3

**Objectif :** connecter le lobby au moteur de jeu sans dupliquer ses
responsabilités.

### READY --- tâches indépendantes

-   [ ] Préparer les tests du démarrage : mauvais hôte, moins de 3
    joueurs, salon non disponible.
-   [ ] Définir les états de chargement et d'erreur côté interface.
-   [ ] Documenter le contrat attendu entre Rooms et le moteur de jeu.

### BLOCKED / INTEGRATION

-   [ ] Intégrer le contrat officiel de démarrage fourni par M1.
-   [ ] Vérifier que seul l'hôte peut lancer la partie.
-   [ ] Vérifier que le salon ne démarre pas avec moins de 3 joueurs.
-   [ ] Coordonner le passage à l'état de jeu et les événements temps
    réel avec M1/M3.
-   [ ] Tester les doubles clics et les demandes concurrentes de
    démarrage.

### Definition of Done

-   [ ] Le démarrage passe par le mécanisme officiel de M1.
-   [ ] Le serveur vérifie toutes les conditions.
-   [ ] Les états du salon et de la partie restent cohérents.

------------------------------------------------------------------------

# Sprint 6 --- Historique, XP, niveaux et leaderboard

**Objectif :** compléter le périmètre Progression en s'appuyant sur les
résultats officiels des parties.

### READY --- tâches indépendantes

-   [ ] Concevoir les écrans d'historique et de progression avec des
    données fictives.
-   [ ] Définir les tests attendus pour XP, niveaux et classement.
-   [ ] Documenter les règles de calcul à confirmer avec l'équipe.

### BLOCKED / INTEGRATION

-   [ ] Confirmer avec M1 le format et la source officielle des
    résultats.
-   [ ] Appliquer les règles d'XP validées dans le playbook.
-   [ ] Persister l'historique et la progression.
-   [ ] Implémenter les endpoints de progression et de leaderboard.
-   [ ] Vérifier qu'un résultat ne crédite pas l'XP plusieurs fois.

### Endpoints envisagés --- à valider avant implémentation

-   `GET /history/me`
-   `GET /progression/me`
-   `GET /leaderboard`

### Definition of Done

-   [ ] Les données persistées correspondent aux résultats officiels.
-   [ ] Les règles d'XP et de niveau sont testées.
-   [ ] Les données d'un utilisateur ne sont pas accessibles sans
    autorisation.

------------------------------------------------------------------------

# Sprint 7 --- Stabilisation et livraison M4

**Objectif :** rendre le module testable et intégrable par l'équipe.

-   [ ] Exécuter les tests unitaires et d'intégration.
-   [ ] Tester les cas limites : salon plein, départ de l'hôte, dernier
    joueur, code invalide, double démarrage.
-   [ ] Vérifier la validation des entrées et les autorisations côté
    serveur.
-   [ ] Vérifier les migrations sur un environnement de développement
    propre, sans effacer les données existantes.
-   [ ] Documenter les endpoints, leurs corps de requête et leurs
    réponses.
-   [ ] Vérifier le lint et le build.
-   [ ] Faire une démonstration du parcours complet disponible.
-   [ ] Lister clairement les éléments restant bloqués par les autres
    modules.

### Definition of Done

-   [ ] Build réussi.
-   [ ] Tests pertinents réussis.
-   [ ] API documentée.
-   [ ] Intégration vérifiée ou dépendances restantes explicitement
    listées.
-   [ ] Aucun secret ni fichier `.env` commité.

------------------------------------------------------------------------

## Ma routine quotidienne

Au début de la session : - \[ \] Choisir **une tâche principale** et une
petite tâche secondaire. - \[ \] Vérifier les tâches bloquées. - \[ \]
Définir le résultat concret attendu aujourd'hui.

À la fin de la session : - \[ \] Tester ce qui a été modifié. - \[ \]
Noter ce qui fonctionne. - \[ \] Noter les erreurs et la prochaine
action précise. - \[ \] Faire un commit sur la branche de fonctionnalité
si le changement est cohérent et testé.

### Mini journal quotidien

Copier ce bloc à la fin de chaque journée :

``` text
Date :
Sprint / jour :
Tâche principale :
Résultat obtenu :
Tests effectués :
Blocage éventuel :
Ce que j’ai appris :
Prochaine action :
```

------------------------------------------------------------------------

## Revue de fin de sprint --- vendredi ou dernier jour de la semaine

Répondre à ces questions :

1.  Qu'est-ce qui fonctionne réellement et peut être démontré ?
2.  Quelles tâches sont terminées, incomplètes ou bloquées ?
3.  Qu'est-ce qui m'a ralenti ?
4.  Quelle dépendance dois-je relancer auprès de l'équipe ?
5.  Quelle est la priorité du prochain sprint ?

Ne pas considérer une tâche terminée si elle n'est ni testée ni
comprise.

------------------------------------------------------------------------

## Rappels importants

-   Les sprints sont un **ordre de travail proposé**, pas une promesse
    de livraison fixe.
-   Si M1/M2/M3 prennent du retard, avancer sur les tests, les règles
    métier, l'interface avec données fictives et la documentation.
-   Ne pas inventer un second modèle utilisateur ou une authentification
    parallèle.
-   Ne pas appliquer de migration partagée avant d'avoir confirmé les
    contrats et la stratégie Git de l'équipe.
-   Ne jamais utiliser une réinitialisation de base ou supprimer des
    volumes Docker pour résoudre un problème de migration.
-   Adapter le planning chaque semaine en fonction de ce qui est
    réellement disponible.

**Règle personnelle : chaque jour, je dois pouvoir montrer un petit
progrès vérifiable, même si l'intégration complète dépend encore de
l'équipe.**
