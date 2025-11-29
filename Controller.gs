/**
 * Controller.gs
 * Handles all server-side logic and routing.
 */

// =========================================================================
// PUBLIC ROUTING (Accessible par google.script.run)
// =========================================================================

/**
 * Appelée par le client au chargement de la page pour vérifier l'état initial.
 * @return {Object} Un objet contenant la route requise.
 */
function getInitialAppStatus() {
  try {
    // La structure est vérifiée et générée implicitement si nécessaire par isSetupNeeded.
    const setupNeeded = isSetupNeeded(); 
    
    return { 
        route: 'CHOICE_REQUIRED', 
        setupNeeded: setupNeeded, 
        status: 'OK' 
    };
  } catch (e) {
    return { route: 'ERROR', message: e.message, status: 'ERROR' };
  }
}

/**
 * Authentifie l'utilisateur Google actif et renvoie son rôle.
 */
function authenticateUser() {
  try {
    const userEmail = Session.getActiveUser().getEmail(); 
    const collaborator = getCollaborator(userEmail);
    
    if (collaborator) {
      const role = String(collaborator.role).toUpperCase();
      let route;

      if (role === 'ADMIN' || role === 'MANAGER') {
        route = 'MANAGER_VIEW';
      } else if (role === 'COLLABORATEUR' || role === 'COLLABORATOR') {
        route = 'COLLABORATOR_VIEW';
      } else {
         route = 'NOT_FOUND';
      }
      
      return {
        route: route,
        user: collaborator,
        status: 'OK'
      };
    } else {
      return { 
        route: 'NOT_FOUND', 
        status: 'ERROR', 
        message: "Votre email (" + userEmail + ") n'est pas dans la liste des collaborateurs. Veuillez contacter votre administrateur." 
      };
    }
  } catch (e) {
      return { route: 'ERROR', message: e.message, status: 'ERROR' };
  }
}

/**
 * Gère la logique de création initiale du centre et de l'administrateur.
 */
function completeSetup(setupData) {
    try {
        if (!isSetupNeeded()) {
             throw new Error("La configuration a déjà été effectuée par un administrateur.");
        }
        
        // 1. NOUVEAU: Créer la feuille de calcul dédiée pour ce centre.
        const ss = SpreadsheetApp.create(`Euromaster HS - Centre ${setupData.codeCentre}`);
        setSpreadsheetId(ss.getId()); // Enregistrer l'ID dans les ScriptProperties
        
        // 2. Initialiser la structure (crée les onglets et les en-têtes)
        initializeDatabaseStructure(ss); 
        
        // 3. Enregistrer les horaires de référence du centre
        createRefSchedule({
            codeCentre: setupData.codeCentre,
            startTime: setupData.heureDebut,
            endTime: setupData.heureFin,
            pauseDurationMinutes: setupData.dureePause
        });
        
        // 4. Enregistrer l'utilisateur comme Administrateur (rôle 'MANAGER')
        const adminEmail = Session.getActiveUser().getEmail();

        createCollaborator({
            matricule: setupData.matricule,
            nom: setupData.nom,
            prenom: setupData.prenom,
            email: adminEmail, // Utilise l'email authentifié
            code_centre: setupData.codeCentre,
            role: 'MANAGER' 
        });

        return { status: 'SUCCESS', message: 'Configuration initiale terminée. Connexion en cours...' };

    } catch (e) {
        return { status: 'ERROR', message: "Erreur lors de la configuration: " + e.message };
    }
}

/**
 * NOUVEAU: Récupère l'ID et l'URL de la feuille de calcul stockée dynamiquement.
 */
function getSpreadsheetInfo() {
  const ssId = PropertiesService.getScriptProperties().getProperty('EUROMAS_HS_SPREADSHEET_ID');
  
  if (!ssId) {
    return { id: 'Non configuré', url: '#' };
  }
  
  const url = `https://docs.google.com/spreadsheets/d/${ssId}/edit`;
  
  return { id: ssId, url: url };
}


// =========================================================================
// COLLABORATOR / OVERTIME Logic (Reste inchangé)
// =========================================================================

function calculateOvertimeDuration(hours, minutes, codeCentre) {
  const refSchedule = getRefSchedule(codeCentre);
  
  if (hours < 0 || minutes < 0 || minutes >= 60) {
      throw new Error('Les heures et minutes saisies sont invalides.');
  }
  
  if (hours === 0 && minutes === 0) {
      throw new Error('Veuillez saisir une durée supérieure à zéro.');
  }

  return {
    hours: hours,
    minutes: minutes
  };
}

function logOvertimeEntry(formObject) {
  try {
    const calculated = calculateOvertimeDuration(
      formObject.hours, 
      formObject.minutes, 
      formObject.codeCentre
    );
    
    const entry = {
      matricule: formObject.matricule,
      nom: formObject.nom,
      prenom: formObject.prenom,
      date: formObject.date,
      hours: calculated.hours,
      minutes: calculated.minutes,
      description: formObject.description
    };
    
    logOvertime(entry);
    
    return { success: true, message: 'Heures supplémentaires soumises avec succès !' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getHistory(matricule) {
  return getOvertimeHistory(matricule);
}

function cancelOvertimeEntry(rowId) {
    try {
        if (deleteOvertimeEntry(rowId)) {
            return { success: true, message: 'Saisie annulée avec succès.' };
        }
        return { success: false, error: 'Échec de l\'annulation. La saisie n\'a pas été trouvée.' };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// =========================================================================
// MANAGER Logic (Reste inchangé)
// =========================================================================

function getApprovals(managerCodeCentre) {
  return getPendingApprovals(managerCodeCentre);
}

function handleApproval(rowId, action, managerMatricule, rejectionReason) {
  try {
    let status = action === 'APPROUVE' ? 'APPROUVE' : 'REJETE';
    
    if (action === 'REJECT' && !rejectionReason) {
        throw new Error('Le motif de rejet est obligatoire.'); 
    }
    
    if (updateStatus(rowId, status, managerMatricule, rejectionReason)) {
      return { success: true, message: `Saisie ${status.toLowerCase()} avec succès.` };
    }
    return { success: false, error: e.message };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// =========================================================================
// CRUD Collaborators Functions (Reste inchangé)
// =========================================================================

function getAllCollaboratorsController() {
  return getAllCollaborators(); 
}

function manageCollaborator(action, collabData) {
  try {
    let success = false;
    
    if (!collabData || !collabData.matricule) {
       throw new Error('Le matricule est requis.');
    }
    
    if (action === 'CREATE') {
      if (getCollaborator(collabData.matricule)) {
          throw new Error('Erreur: Ce matricule existe déjà dans la base de données.');
      }
      success = createCollaborator(collabData);
    } else if (action === 'UPDATE') {
      success = updateCollaborator(collabData);
    } else if (action === 'DELETE') {
      success = deleteCollaborator(collabData.matricule);
    } else {
      throw new Error('Action non supportée.');
    }
    
    if (!success) {
      throw new Error("Opération échouée. L'utilisateur n'a peut-être pas été trouvé.");
    }
    
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}