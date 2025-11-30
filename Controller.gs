/**
 * Controller.gs
 * Handles all server-side logic and routing.
 */

// =========================================================================
// PUBLIC ROUTING (Accessible par google.script.run)
// =========================================================================

function getInitialAppStatus() {
  try {
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

function authenticateUser(token) {
  try {
    let collaborator = null;

    if (token) {
        collaborator = getCollaboratorByToken(token);
        if (!collaborator) {
             return { route: 'ERROR', message: "Lien invalide ou expiré.", status: 'ERROR' };
        }
    } 
    else {
        const userEmail = Session.getActiveUser().getEmail();
        if (userEmail) {
            collaborator = getCollaborator(userEmail);
        }
    }

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
        message: "Authentification échouée. Veuillez utiliser votre lien personnel ou vous connecter avec un compte Google autorisé."
      };
    }
  } catch (e) {
      return { route: 'ERROR', message: e.message, status: 'ERROR' };
  }
}

function completeSetup(setupData) {
    try {
        if (!isSetupNeeded()) {
             throw new Error("La configuration a déjà été effectuée par un administrateur.");
        }
        
        const ss = SpreadsheetApp.create(`Euromaster HS - Centre ${setupData.codeCentre}`);
        setSpreadsheetId(ss.getId());
        initializeDatabaseStructure(ss);
        
        createRefSchedule({
            codeCentre: setupData.codeCentre,
            startTime: setupData.heureDebut,
            endTime: setupData.heureFin,
            pauseDurationMinutes: setupData.dureePause
        });

        const adminEmail = Session.getActiveUser().getEmail();
        createCollaborator({
            matricule: setupData.matricule,
            nom: setupData.nom,
            prenom: setupData.prenom,
            email: adminEmail, 
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

function sendOvertimeRequestEmails(emails, senderName) {
  Logger.log('--- Démarrage de sendOvertimeRequestEmails ---');
  try {
    const isManual = emails && emails.length > 0;
    let recipients = [];
    const allCollaborators = getAllCollaborators();
    
    const appUrl = ScriptApp.getService().getUrl(); 

    if (isManual) {
        recipients = allCollaborators.filter(c => emails.includes(c.email));
    } else {
        recipients = allCollaborators.filter(c => String(c.role).toUpperCase() === 'COLLABORATOR' || String(c.role).toUpperCase() === 'COLLABORATEUR');
        senderName = "Système de Rappel Automatique";
    }

    if (recipients.length === 0) {
        return { success: false, message: "Aucun destinataire trouvé pour l'envoi." };
    }

    const subject = `[EUROMASTER] Rappel : Saisie de vos heures supplémentaires`;
    
    let sentCount = 0;
    
    recipients.forEach(collaborator => {
        let personalLink = appUrl;
        if (collaborator.token) {
            personalLink += `?token=${collaborator.token}`;
        }

        const htmlBody = `
          <div style="font-family: sans-serif; color: #333;">
            <h2 style="color: #003399;">Bonjour ${collaborator.prenom},</h2>
            <p>Ceci est un rappel pour vous inviter à saisir ou consulter vos heures supplémentaires sur le portail Euromaster.</p>
            
            <p>Cliquez sur le bouton ci-dessous pour accéder directement à votre espace (aucun mot de passe requis).</p>

            <div style="margin: 20px 0;">
              <a href="${personalLink}" style="background-color: #003399; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Accéder à mon Espace Collaborateur
              </a>
            </div>
            
            <p style="font-size: 12px; color: #666;">Ne partagez pas ce lien, il vous donne un accès direct à votre compte.</p>
            <hr>
            <p style="font-size: 11px; color: #999;">Ceci est un message automatique envoyé par ${senderName}.</p>
          </div>
        `;
        
        MailApp.sendEmail({
            to: collaborator.email,
            subject: subject,
            htmlBody: htmlBody
        });
        sentCount++;
    });

    return { success: true, message: `E-mails envoyés avec liens personnels à ${sentCount} collaborateur(s).` };
  } catch (e) {
    Logger.log('ERREUR FATALE MAIL: ' + e.message);
    return { success: false, message: "Erreur serveur lors de l'envoi : " + e.message };
  }
}

function weeklyOvertimeRequestTrigger() {
    sendOvertimeRequestEmails(null, "Système");
}

function setOvertimeRequestTrigger(time, dayOfWeek) {
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

function deleteOvertimeRequestTrigger() {
    const triggers = ScriptApp.getProjectTriggers();
    for (let i = 0; i < triggers.length; i++) {
        if (triggers[i].getHandlerFunction() === 'weeklyOvertimeRequestTrigger') {
            ScriptApp.deleteTrigger(triggers[i]);
        }
    }
    return { success: true, message: "Planification automatique supprimée." };
}

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
    return { active: false, description: "Inactif - Aucune planification automatique en cours."
    };
}

// =========================================================================
// COLLABORATOR / OVERTIME Logic
// =========================================================================

function calculateOvertimeDuration(startTime, endTime, codeCentre) {
  const refSchedule = getRefSchedule(codeCentre);
  const start = new Date('1970-01-01T' + startTime + 'Z');
  const end = new Date('1970-01-01T' + endTime + 'Z');
  let diffMs = end - start;
  if (diffMs < 0) {
    throw new Error('L\'heure de fin doit être après l\'heure de début.');
  }
  const totalMinutes = diffMs / (1000 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  if (hours === 0 && minutes === 0) {
      throw new Error('Veuillez saisir une durée supérieure à zéro.');
  }
  return { hours: hours, minutes: minutes };
}

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
      hours: calculated.hours, 
      minutes: calculated.minutes, 
      description: formObject.description
    };
    logOvertime(entry);
    return { success: true, message: `Heures supplémentaires soumises: ${calculated.hours}h ${calculated.minutes}min. En attente de validation.` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getHistory(matricule) {
  return getOvertimeHistory(matricule);
}

function getMyStats(matriculeOverride) {
    if (matriculeOverride) {
        return getCollaboratorStats(matriculeOverride);
    }
    
    const userEmail = Session.getActiveUser().getEmail();
    const collaborator = getCollaborator(userEmail);
    if(collaborator) {
        return getCollaboratorStats(collaborator.matricule);
    }
    throw new Error("Utilisateur non trouvé");
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
// MANAGER Logic
// =========================================================================

function getApprovals(managerCodeCentre) {
  return getPendingApprovals(managerCodeCentre);
}

function getCollaboratorHistoryForManager(targetMatricule) {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    const manager = getCollaborator(userEmail);
    
    if (!manager || (String(manager.role) !== 'MANAGER' && String(manager.role) !== 'ADMIN')) {
        throw new Error("Accès refusé. Vous n'avez pas les droits de manager.");
    }
    
    return getOvertimeHistory(targetMatricule);
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * MODIFIÉ : Correction du BUG 'APPROUVE' vs 'APPROVE'.
 * Accepte désormais les deux orthographes.
 */
function handleApproval(rowId, action, managerMatricule, rejectionReason) {
  try {
    // CORRECTION ICI : "Ou logique" pour accepter les deux versions
    let status = (action === 'APPROUVE' || action === 'APPROVE') ? 'APPROUVE' : 'REJETE';
    
    if (action === 'REJECT' && !rejectionReason) {
        throw new Error('Le motif de rejet est obligatoire.');
    }
    if (updateStatus(rowId, status, managerMatricule, rejectionReason)) {
      return { success: true, message: `Saisie ${status.toLowerCase()} avec succès.` };
    }
    return { success: false, error: "Échec de la mise à jour du statut." };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getSpreadsheetInfo() {
  const ssId = PropertiesService.getScriptProperties().getProperty('EUROMAS_HS_SPREADSHEET_ID');
  if (!ssId) {
    return { id: 'Non configuré', url: '#' };
  }
  const url = `https://docs.google.com/spreadsheets/d/${ssId}/edit`;
  return { id: ssId, url: url };
}

function getSchedulesForManager() {
    return getAllRefSchedules();
}

function manageSchedule(action, scheduleData) {
    try {
        let success = false;
        if (action === 'CREATE') {
            success = createRefSchedule(scheduleData);
        } else if (action === 'UPDATE') {
            success = updateRefSchedule(scheduleData);
        } else if (action === 'DELETE') {
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