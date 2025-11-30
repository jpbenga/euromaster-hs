/**
 * Controller.gs
 * Handles all server-side logic and routing.
 */

// =========================================================================
// PUBLIC ROUTING (Accessible par google.script.run)
// =========================================================================

/**
 * Récupère l'état initial de l'application (besoin de setup ou non).
 */
function getInitialAppStatus() {
  try {
    // isSetupNeeded() est supposée être définie dans Database.gs
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
    // getCollaborator() est supposée être dans Database.gs
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
        
        // 1. Créer la feuille de calcul dédiée pour ce centre.
        const ss = SpreadsheetApp.create(`Euromaster HS - Centre ${setupData.codeCentre}`);
        // setSpreadsheetId() est supposée être dans Database.gs
        setSpreadsheetId(ss.getId()); 
        
        // 2. Initialiser la structure (crée les onglets et les en-têtes)
        // initializeDatabaseStructure() est supposée être dans Database.gs
        initializeDatabaseStructure(ss); 
        
        // 3. Enregistrer les horaires de référence du centre
        // createRefSchedule() est supposée être dans Database.gs
        createRefSchedule({
            codeCentre: setupData.codeCentre,
            startTime: setupData.heureDebut,
            endTime: setupData.heureFin,
            pauseDurationMinutes: setupData.dureePause
        });
        
        // 4. Enregistrer l'utilisateur comme Administrateur (rôle 'MANAGER')
        const adminEmail = Session.getActiveUser().getEmail();

        // createCollaborator() est supposée être dans Database.gs
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


// =========================================================================
// GESTION DES RAPPELS (EMAIL & TRIGGER)
// =========================================================================

/**
 * Fonction CORE pour envoyer les emails de demande de saisie.
 */
function sendOvertimeRequestEmails(emails, senderName) {
  Logger.log('--- Démarrage de sendOvertimeRequestEmails ---');
  try {
    const isManual = emails && emails.length > 0;
    let recipients = [];
    
    // getAllCollaborators() est supposée être dans Database.gs
    const allCollaborators = getAllCollaborators(); 
    
    Logger.log('Nombre total de collaborateurs trouvés: ' + allCollaborators.length);

    if (isManual) {
        recipients = allCollaborators.filter(c => emails.includes(c.email));
        Logger.log('Mode manuel: Cible les emails suivants: ' + emails.join(', '));
    } else {
        recipients = allCollaborators.filter(c => String(c.role).toUpperCase() === 'COLLABORATOR' || String(c.role).toUpperCase() === 'COLLABORATEUR');
        senderName = "Système de Rappel Automatique";
        Logger.log('Mode automatique: Cible les rôles COLLABORATOR');
    }

    if (recipients.length === 0) {
        Logger.log('ERREUR LOGIQUE: recipients.length est zéro. Annulation de l\'envoi.');
        return { success: false, message: "Aucun destinataire trouvé pour l'envoi." };
    }

    const subject = `[EUROMASTER] Rappel: Saisie Hebd. Heures Supplémentaires (${senderName})`;
    
    const emailBody = (collaborator) => `
        Bonjour ${collaborator.prenom},

        Ceci est un rappel de ${senderName} pour vous inviter à saisir vos heures supplémentaires de la semaine écoulée via le portail Euromaster HS.

        Veuillez vous connecter à l'application pour effectuer votre saisie.
        
        ---
        Ceci est un message automatique.
    `;
    
    let sentCount = 0;
    
    recipients.forEach(collaborator => {
        const body = emailBody(collaborator);
        
        Logger.log(`TENTATIVE D'ENVOI à: ${collaborator.email} (Prénom: ${collaborator.prenom})`);
        
        // ACTIVATION DE L'ENVOI RÉEL PAR MAILAPP
        MailApp.sendEmail({
            to: collaborator.email,
            subject: subject,
            body: body
        });
        sentCount++;
    });

    Logger.log('--- Fin de sendOvertimeRequestEmails. Nombre d\'envois: ' + sentCount);
    return { success: true, message: `E-mails de demande de saisie envoyés à ${sentCount} collaborateur(s).` };

  } catch (e) {
    Logger.log('ERREUR FATALE MAIL: ' + e.message + ' Stack: ' + e.stack);
    return { success: false, message: "Erreur serveur lors de l'envoi des emails: " + e.message };
  }
}

/**
 * Fonction appelée par le déclencheur Apps Script pour l'envoi hebdomadaire.
 */
function weeklyOvertimeRequestTrigger() {
    sendOvertimeRequestEmails(null, "Système"); 
}

/**
 * Crée le déclencheur hebdomadaire.
 */
function setOvertimeRequestTrigger(time, dayOfWeek) {
    // deleteOvertimeRequestTrigger() est supposée être définie plus bas
    deleteOvertimeRequestTrigger(); 

    const days = {
        'SUNDAY': ScriptApp.WeekDay.SUNDAY,
        'MONDAY': ScriptApp.WeekDay.MONDAY,
        'TUESDAY': ScriptApp.WeekDay.TUESDAY,
        'WEDNESDAY': ScriptApp.WeekDay.WEDNESDAY,
        'THURSDAY': ScriptApp.WeekDay.THURSDAY,
        'FRIDAY': ScriptApp.WeekDay.FRIDAY,
        'SATURDAY': ScriptApp.WeekDay.SATURDAY
    };
    
    const [hours, minutes] = time.split(':').map(Number);
    const day = days[dayOfWeek.toUpperCase()];
    
    if (!day) {
        throw new Error("Jour de la semaine invalide.");
    }

    ScriptApp.newTrigger('weeklyOvertimeRequestTrigger')
      .timeBased()
      .onWeekDay(day)
      .atHour(hours)
      .nearMinute(minutes)
      .create();
      
    return { success: true, message: `Rappel hebdomadaire planifié pour chaque ${dayOfWeek} à ${time}.` };
}

/**
 * Supprime tous les triggers liés à cette fonction.
 */
function deleteOvertimeRequestTrigger() {
    const triggers = ScriptApp.getProjectTriggers();
    for (let i = 0; i < triggers.length; i++) {
        if (triggers[i].getHandlerFunction() === 'weeklyOvertimeRequestTrigger') {
            ScriptApp.deleteTrigger(triggers[i]);
        }
    }
    return { success: true, message: "Planification automatique supprimée." };
}

/**
 * Récupère le statut et l'heure du trigger.
 */
function getTriggerStatus() {
    const triggers = ScriptApp.getProjectTriggers();
    for (let i = 0; i < triggers.length; i++) {
        if (triggers[i].getHandlerFunction() === 'weeklyOvertimeRequestTrigger') {
            return {
                active: true,
                description: `Actif - Planifié par le système.`
            };
        }
    }
    return { active: false, description: "Inactif - Aucune planification automatique en cours." };
}


// =========================================================================
// COLLABORATOR / OVERTIME Logic
// =========================================================================

/**
 * Calcule la durée des heures supplémentaires.
 */
function calculateOvertimeDuration(startTime, endTime, codeCentre) {
  // getRefSchedule() est supposée être dans Database.gs
  const refSchedule = getRefSchedule(codeCentre);
  
  const start = new Date('1970-01-01T' + startTime + 'Z');
  const end = new Date('1970-01-01T' + endTime + 'Z');
  
  let diffMs = end - start;
  if (diffMs < 0) {
    throw new Error('L\'heure de fin doit être après l\'heure de début.');
  }

  // Conversion en heures et minutes totales
  const totalMinutes = diffMs / (1000 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  
  if (hours === 0 && minutes === 0) {
      throw new Error('Veuillez saisir une durée supérieure à zéro.');
  }

  return {
    hours: hours,
    minutes: minutes
  };
}


/**
 * Enregistre une nouvelle demande d'heures supplémentaires.
 */
function logOvertimeEntry(formObject) {
  try {
    const calculated = calculateOvertimeDuration(
      formObject.startTime, 
      formObject.endTime, 
      formObject.codeCentre
    );
    
    const entry = {
      matricule: formObject.matricule,
      nom: formObject.nom,
      prenom: formObject.prenom,
      date: formObject.date,
      hours: calculated.hours, // Durée en heures complètes
      minutes: calculated.minutes, // Durée en minutes restantes
      description: formObject.description
    };
    
    // logOvertime() est supposée être dans Database.gs
    logOvertime(entry);
    
    return { success: true, message: `Heures supplémentaires soumises: ${calculated.hours}h ${calculated.minutes}min. En attente de validation.` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Récupère l'historique des saisies d'un collaborateur.
 */
function getHistory(matricule) {
  // getOvertimeHistory() est supposée être dans Database.gs
  return getOvertimeHistory(matricule);
}

/**
 * Annule une saisie si elle est en attente.
 */
function cancelOvertimeEntry(rowId) {
    try {
        // deleteOvertimeEntry() est supposée être dans Database.gs
        if (deleteOvertimeEntry(rowId)) {
            return { success: true, message: 'Saisie annulée avec succès.' };
        }
        return { success: false, error: 'Échec de l\'annulation. La saisie n\'a pas été trouvée.' };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// =========================================================================
// MANAGER Logic
// =========================================================================

/**
 * Récupère toutes les demandes en attente pour le centre du manager.
 */
function getApprovals(managerCodeCentre) {
  // getPendingApprovals() est supposée être dans Database.gs
  return getPendingApprovals(managerCodeCentre);
}

/**
 * Gère l'approbation ou le rejet d'une demande.
 */
function handleApproval(rowId, action, managerMatricule, rejectionReason) {
  try {
    let status = action === 'APPROUVE' ? 'APPROUVE' : 'REJETE';
    
    if (action === 'REJECT' && !rejectionReason) {
        throw new Error('Le motif de rejet est obligatoire.'); 
    }
    
    // updateStatus() est supposée être dans Database.gs
    if (updateStatus(rowId, status, managerMatricule, rejectionReason)) {
      // NOTE: Un email de notification au collaborateur pourrait être ajouté ici.
      return { success: true, message: `Saisie ${status.toLowerCase()} avec succès.` };
    }
    return { success: false, error: "Échec de la mise à jour du statut." };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Retourne l'ID et le lien de la feuille de calcul BDD.
 */
function getSpreadsheetInfo() {
  const ssId = PropertiesService.getScriptProperties().getProperty('EUROMAS_HS_SPREADSHEET_ID');
  
  if (!ssId) {
    return { id: 'Non configuré', url: '#' };
  }
  
  const url = `https://docs.google.com/spreadsheets/d/${ssId}/edit`;
  
  return { id: ssId, url: url };
}

/**
 * Récupère tous les horaires de référence.
 */
function getSchedulesForManager() {
    // getAllRefSchedules() est supposée être dans Database.gs
    return getAllRefSchedules();
}

/**
 * Crée, met à jour ou supprime un horaire de référence.
 */
function manageSchedule(action, scheduleData) {
    try {
        let success = false;
        
        if (action === 'CREATE') {
            // createRefSchedule() est supposée être dans Database.gs
            success = createRefSchedule(scheduleData);
        } else if (action === 'UPDATE') {
            // updateRefSchedule() est supposée être dans Database.gs
            success = updateRefSchedule(scheduleData);
        } else if (action === 'DELETE') {
            // deleteRefSchedule() est supposée être dans Database.gs
            success = deleteRefSchedule(scheduleData.codeCentre);
        } else {
            throw new Error('Action non supportée.');
        }

        if (!success) {
            throw new Error('Opération échouée. Le code centre n\'a peut-être pas été trouvé.');
        }

        return { success: true, message: `Opération '${action}' sur l'horaire réussie.` };

    } catch (e) {
        return { success: false, error: e.message };
    }
}


// --- CRUD Collaborators Functions ---
/**
 * Récupère tous les collaborateurs.
 */
function getAllCollaboratorsController() {
  // getAllCollaborators() est supposée être dans Database.gs
  return getAllCollaborators(); 
}

/**
 * Crée, met à jour ou supprime un collaborateur.
 */
function manageCollaborator(action, collabData) {
  try {
    let success = false;
    
    if (!collabData || !collabData.matricule) {
       throw new Error('Le matricule est requis.');
    }
    
    if (action === 'CREATE') {
      // Vérifie l'existence avant la création
      if (getCollaborator(collabData.matricule)) {
          throw new Error('Erreur: Ce matricule existe déjà dans la base de données.');
      }
      // createCollaborator() est supposée être dans Database.gs
      success = createCollaborator(collabData);
    } else if (action === 'UPDATE') {
      // updateCollaborator() est supposée être dans Database.gs
      success = updateCollaborator(collabData);
    } else if (action === 'DELETE') {
      // deleteCollaborator() est supposée être dans Database.gs
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