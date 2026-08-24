Prospecting Fanatical — CRM
Déploiement, étape par étape
1. Configurer la base de données (Supabase)
Va sur ton dashboard Supabase → crée un nouveau projet (choisis une région proche, ex. `us-east-1`).
Une fois le projet prêt, va dans SQL Editor → New query.
Colle tout le contenu du fichier `supabase-schema.sql` (dans ce dossier) et clique Run.
Va dans Project Settings → API. Note deux valeurs :
Project URL (ex: `https://xxxxx.supabase.co`)
anon public key (une longue chaîne de caractères)
Tu en auras besoin à l'étape 3.
(Optionnel mais recommandé) Va dans Authentication → Providers → Email et désactive
"Confirm email" si tu veux que les 3 comptes puissent se connecter immédiatement après inscription,
sans cliquer un lien de confirmation reçu par courriel.
2. Mettre le code sur GitHub
Va sur github.com → New repository → nomme-le `prospecting-fanatical-crm` → Create repository.
Sur la page du nouveau repo, clique uploading an existing file.
Fais glisser TOUS les fichiers et dossiers de ce projet (garde la structure de dossiers intacte —
`app/`, `lib/`, `package.json`, etc.) dans la zone de dépôt.
Clique Commit changes.
3. Déployer sur Vercel
Va sur ton dashboard Vercel → Add New → Project.
Choisis le repo `prospecting-fanatical-crm` que tu viens de créer → Import.
Avant de cliquer Deploy, ouvre la section Environment Variables et ajoute :
`NEXT_PUBLIC_SUPABASE_URL` → colle le Project URL de l'étape 1
`NEXT_PUBLIC_SUPABASE_ANON_KEY` → colle le anon public key de l'étape 1
Clique Deploy. Après ~1-2 minutes, Vercel te donne un lien (ex: `prospecting-fanatical-crm.vercel.app`).
4. Créer vos 3 comptes
Ouvre le lien Vercel → clique "En créer un" (mode inscription).
Chacun de vous trois crée son compte avec son courriel + un nom d'affichage (Gab, PA, Joe).
Connectez-vous — vous êtes dans le CRM, vide pour l'instant.
5. Importer vos données existantes (805 dealers + CSV de sauvegarde)
Pas besoin de coder un import — Supabase a un outil intégré :
Dans Supabase, va dans Table Editor → sélectionne la table `dealers`.
Clique Insert → Import data from CSV.
Choisis ton fichier CSV (celui de l'ancien artifact, ou le fichier original).
Important : les noms de colonnes du CSV doivent correspondre aux noms de colonnes de la table
(`responsable`, `concession`, `contact`, `telephone`, `email`, `statut_appel`, `engagement`,
`date_dernier_contact`, `date_prochain_suivi`, `note`) — l'outil d'import de Supabase te permet de
faire correspondre les colonnes manuellement si les noms ne matchent pas exactement.
Mises à jour futures
Chaque fois que Claude te donne du nouveau code : remplace les fichiers correspondants dans ton repo
GitHub (via "Upload files" à nouveau, ou en éditant directement sur github.com). Vercel redéploie
automatiquement à chaque changement sur GitHub — aucune donnée n'est jamais touchée, puisque le code
et la base de données Supabase sont deux choses complètement séparées.
Ce qui manque encore (V1 → prochaines itérations)
Import en masse depuis l'interface (utilise l'import CSV de Supabase en attendant)
Détection de doublons à l'ajout
Restauration depuis une sauvegarde CSV directement dans l'app
Historique d'appels personnel séparé (actuellement visible dans l'historique de chaque dealer)
