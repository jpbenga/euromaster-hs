/**
 * Database.gs
 * Handles all interactions with the Google Sheet, including CRUD for Collaborators and Overtime logs.
 */

// CONFIGURATION
// NOUVEAU: L'ID DE LA FEUILLE EST MAINTENANT STOCKÉ DANS LES PROPRIÉTÉS DU SCRIPT (non plus en dur).
const SPREADSHEET_ID_KEY = 'EUROMAS_HS_SPREADSHEET_ID'; 

const SHEET_NAMES = {
  COLLABORATORS: 'COLLABORATEURS',
  SCHEDULES: 'HORAIRES_REF', 
  OVERTIME: 'SAISIES_HS' 
};

/**
 * Helper to get the Spreadsheet object.
 * @return {Spreadsheet} The Spreadsheet object.
 */
function getSpreadsheet() {
  const ssId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_KEY);
  
  if (!ssId) {
     throw new Error("L'ID de la base de données n'a pas été configuré. L'application doit être initialisée.");
  }
  
  const ss = SpreadsheetApp.openById(ssId);
  if (!ss) { 
      // Vérifie si openById a retourné null (ID invalide ou accès refusé)
      throw new Error("La feuille de calcul n'a pas pu être ouverte. Veuillez vérifier l'ID enregistré ou les permissions.");
  }
  return ss;
}

/**
 * NOUVEAU: Stocke l'ID de la nouvelle feuille de calcul dans les propriétés du script.
 * Ceci lie cette installation Apps Script à sa BDD unique.
 * @param {string} ssId - The ID of the newly created Spreadsheet.
 */
function setSpreadsheetId(ssId) {
    PropertiesService.getScriptProperties().setProperty(SPREADSHEET_ID_KEY, ssId);
}

/**
 * Checks if the collaborators sheet has data beyond the header row.
 * @return {boolean} True if setup is needed (only header exists or sheet is empty).
 */
function isSetupNeeded() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.COLLABORATORS);
    
    if (!sheet) {
        return true;
    }
    
    // Si le nombre de lignes est <= 1 (juste l'en-tête ou vide), l'installation est requise.
    return sheet.getLastRow() <= 1; 
  } catch (e) {
      // Si getSpreadsheet échoue parce que l'ID n'est pas encore enregistré (cas normal au démarrage), le Setup est requis.
      if (e.message.includes('ID de la base de données n\'a pas été configuré')) {
          return true;
      }
      // Gère le cas où l'ID est là, mais la feuille ne peut pas être ouverte (ID invalide/supprimé)
      if (e.message.includes('La feuille de calcul n\'a pas pu être ouverte')) {
          return true;
      }
      throw e;
  }
}

/**
 * Crée les feuilles de calcul et définit les en-têtes si elles sont manquantes.
 * @param {Spreadsheet} ss - Le Spreadsheet object (peut être nouvellement créé ou existant).
 */
function initializeDatabaseStructure(ss) {
    // 1. COLLABORATEURS
    let collabSheet = ss.getSheetByName(SHEET_NAMES.COLLABORATORS);
    if (!collabSheet) {
        collabSheet = ss.insertSheet(SHEET_NAMES.COLLABORATORS);
    }
    if (collabSheet.getLastRow() < 1) {
        collabSheet.getRange(1, 1, 1, 6).setValues([
            ['ID_MATRICULE', 'NOM', 'PRENOM', 'EMAIL', 'CODE_CENTRE', 'ROLE']
        ]).setFontWeight('bold');
    }


    // 2. HORAIRES_REF
    let scheduleSheet = ss.getSheetByName(SHEET_NAMES.SCHEDULES);
    if (!scheduleSheet) {
        scheduleSheet = ss.insertSheet(SHEET_NAMES.SCHEDULES);
    }
    if (scheduleSheet.getLastRow() < 1) {
        scheduleSheet.getRange(1, 1, 1, 4).setValues([
            ['CODE_CENTRE', 'HEURE_DEBUT_STD', 'HEURE_FIN_STD', 'DUREE_PAUSE']
        ]).setFontWeight('bold');
    }

    // 3. SAISIES_HS
    let overtimeSheet = ss.getSheetByName(SHEET_NAMES.OVERTIME);
    if (!overtimeSheet) {
        overtimeSheet = ss.insertSheet(SHEET_NAMES.OVERTIME);
    }
    if (overtimeSheet.getLastRow() < 1) {
        overtimeSheet.getRange(1, 1, 1, 12).setValues([
            ['DATE_SAISIE', 'DATE_HEURES_SUPP', 'COLLAB_MATRICULE', 'COLLAB_NOM', 'COLLAB_PRENOM', 'HEURES', 'MINUTES', 'DESCRIPTION', 'STATUT', 'DATE_VALIDATION', 'MANAGER_MATRICULE', 'MOTIF_REJET']
        ]).setFontWeight('bold');
    }
    
    // Supprimer l'onglet par défaut s'il est vide
    const defaultSheet = ss.getSheetByName('Feuille 1') || ss.getSheetByName('Sheet1');
    if (defaultSheet && defaultSheet.getLastRow() === 0) {
        ss.deleteSheet(defaultSheet);
    }
}


// =========================================================================
// COLLABORATOR (CRUD) Logic
// ... (Reste des fonctions inchangées)
// =========================================================================

function getCollaborator(identifier) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.COLLABORATORS);
  
  if (!sheet) {
      throw new Error("L'onglet de la feuille de calcul '" + SHEET_NAMES.COLLABORATORS + "' est introuvable.");
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  const headerMap = {};
  headers.forEach((h, i) => headerMap[String(h).trim()] = i); 
  
  const emailFound = typeof headerMap['EMAIL'] !== 'undefined';
  const matriculeFound = typeof headerMap['ID_MATRICULE'] !== 'undefined';
  
  if (!emailFound || !matriculeFound) {
      throw new Error("Feuille COLLABORATEURS : Les en-têtes EMAIL ou ID_MATRICULE sont manquants.");
  }

  const emailIndex = headerMap['EMAIL'];
  const matriculeIndex = headerMap['ID_MATRICULE'];
  
  const normalizedIdentifier = String(identifier).toLowerCase();

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    
    if (String(row[emailIndex]).toLowerCase() === normalizedIdentifier) {
      return {
        matricule: row[matriculeIndex],
        nom: row[headerMap['NOM']],
        prenom: row[headerMap['PRENOM']],
        email: row[emailIndex],
        code_centre: row[headerMap['CODE_CENTRE']],
        role: row[headerMap['ROLE']]
      };
    }
    
    if (String(row[matriculeIndex]) === String(identifier)) {
       return {
        matricule: row[matriculeIndex],
        nom: row[headerMap['NOM']],
        prenom: row[headerMap['PRENOM']],
        email: row[emailIndex],
        code_centre: row[headerMap['CODE_CENTRE']],
        role: row[headerMap['ROLE']]
      };
    }
  }
  return null;
}

function getAllCollaborators() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.COLLABORATORS);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  const collaborators = [];
  
  const headerMap = {};
  headers.forEach((h, i) => headerMap[String(h).trim()] = i);
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    collaborators.push({
      matricule: row[headerMap['ID_MATRICULE']],
      nom: row[headerMap['NOM']],
      prenom: row[headerMap['PRENOM']],
      email: row[headerMap['EMAIL']],
      code_centre: row[headerMap['CODE_CENTRE']],
      role: row[headerMap['ROLE']]
    });
  }
  return collaborators;
}

function createCollaborator(collabData) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.COLLABORATORS);
  
  sheet.appendRow([
    collabData.matricule,
    collabData.nom,
    collabData.prenom,
    collabData.email,
    collabData.code_centre,
    collabData.role
  ]);
  
  return true;
}

function updateCollaborator(collabData) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.COLLABORATORS);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  const headerMap = {};
  headers.forEach((h, i) => headerMap[String(h).trim()] = i);

  const matriculeIndex = headerMap['ID_MATRICULE'];
  
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][matriculeIndex]) == String(collabData.matricule)) {
      const rowIndex = i + 2; 
      
      const rowToUpdate = [
        collabData.matricule,
        collabData.nom,
        collabData.prenom,
        collabData.email,
        collabData.code_centre,
        collabData.role
      ];
      
      sheet.getRange(rowIndex, 1, 1, rowToUpdate.length).setValues([rowToUpdate]);
      return true;
    }
  }
  return false;
}

function deleteCollaborator(matricule) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.COLLABORATORS);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  const headerMap = {};
  headers.forEach((h, i) => headerMap[String(h).trim()] = i);

  const matriculeIndex = headerMap['ID_MATRICULE'];
  
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][matriculeIndex]) == String(matricule)) {
      const rowIndex = i + 2; // Row index to delete (including header offset)
      sheet.deleteRow(rowIndex);
      return true;
    }
  }
  return false;
}

function getRefSchedule(codeCentre) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.SCHEDULES);
  if (!sheet) return null;
  
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  const headerMap = {};
  headers.forEach((h, i) => headerMap[String(h).trim()] = i);
  
  const centreIndex = headerMap['CODE_CENTRE'];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (String(row[centreIndex]) === String(codeCentre)) {
      return {
        startTime: row[headerMap['HEURE_DEBUT_STD']],
        endTime: row[headerMap['HEURE_FIN_STD']],
        pauseDurationMinutes: row[headerMap['DUREE_PAUSE']] || 0 
      };
    }
  }
  return null;
}

function createRefSchedule(scheduleData) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.SCHEDULES);
  
  sheet.appendRow([
    scheduleData.codeCentre,
    scheduleData.startTime,
    scheduleData.endTime,
    scheduleData.pauseDurationMinutes
  ]);
  
  return true;
}

function logOvertime(overtimeData) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.OVERTIME);
  
  sheet.appendRow([
    new Date(), 
    overtimeData.date, 
    overtimeData.matricule, 
    overtimeData.nom, 
    overtimeData.prenom, 
    overtimeData.hours, 
    overtimeData.minutes, 
    overtimeData.description, 
    'EN_ATTENTE', 
    '', 
    '', 
    '' 
  ]);
  
  return true;
}

function getOvertimeHistory(matricule) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.OVERTIME);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  const history = [];
  const headerMap = {};
  headers.forEach((h, i) => headerMap[String(h).trim()] = i);
  
  const matriculeIndex = headerMap['COLLAB_MATRICULE'];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (String(row[matriculeIndex]) === String(matricule)) {
      history.push({
        row_id: i + 2,
        date_supp: row[headerMap['DATE_HEURES_SUPP']],
        hours: row[headerMap['HEURES']],
        minutes: row[headerMap['MINUTES']],
        description: row[headerMap['DESCRIPTION']],
        status: row[headerMap['STATUT']],
        rejectionReason: row[headerMap['MOTIF_REJET']] || null
      });
    }
  }
  history.sort((a, b) => new Date(b.date_supp).getTime() - new Date(a.date_supp).getTime());
  
  return history;
}

function getPendingApprovals(managerCodeCentre) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.OVERTIME);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  const headerMap = {};
  headers.forEach((h, i) => headerMap[String(h).trim()] = i);
  
  const statusIndex = headerMap['STATUT'];
  const pending = [];
  
  const allCollaborators = getAllCollaborators(); 
  const centreCollaborators = allCollaborators.filter(c => String(c.code_centre) === String(managerCodeCentre));
  const validMatricules = centreCollaborators.map(c => String(c.matricule));

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const matricule = String(row[headerMap['COLLAB_MATRICULE']]);

    if (row[statusIndex] === 'EN_ATTENTE' && validMatricules.includes(matricule)) {
      pending.push({
        row_id: i + 2,
        date_supp: row[headerMap['DATE_HEURES_SUPP']],
        matricule: matricule,
        nom: row[headerMap['COLLAB_NOM']],
        prenom: row[headerMap['COLLAB_PRENOM']],
        hours: row[headerMap['HEURES']],
        minutes: row[headerMap['MINUTES']],
        description: row[headerMap['DESCRIPTION']]
      });
    }
  }
  return pending;
}

function updateStatus(rowId, status, managerMatricule, rejectionReason) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.OVERTIME);
  
  const date = new Date();
  
  sheet.getRange(rowId, 9).setValue(status);
  sheet.getRange(rowId, 10).setValue(date);
  sheet.getRange(rowId, 11).setValue(managerMatricule);
  
  if (status === 'REJETE' && rejectionReason) {
      sheet.getRange(rowId, 12).setValue(rejectionReason);
  } else {
      sheet.getRange(rowId, 12).setValue('');
  }
  
  return true;
}

function deleteOvertimeEntry(rowId) {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.OVERTIME);
    
    if (rowId > 1 && rowId <= sheet.getLastRow()) {
        sheet.deleteRow(rowId);
        return true;
    }
    return false;
}