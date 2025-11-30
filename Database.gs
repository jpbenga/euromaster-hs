/**
 * Database.gs
 * Handles all interactions with the Google Sheet.
 */

// CONFIGURATION
const SPREADSHEET_ID_KEY = 'EUROMAS_HS_SPREADSHEET_ID'; 

const SHEET_NAMES = {
  COLLABORATORS: 'COLLABORATEURS',
  SCHEDULES: 'HORAIRES_REF', 
  OVERTIME: 'SAISIES_HS' 
};

function getSpreadsheet() {
  const ssId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_KEY);
  if (!ssId) {
     throw new Error("L'ID de la base de données n'a pas été configuré. L'application doit être initialisée.");
  }
  const ss = SpreadsheetApp.openById(ssId);
  if (!ss) { 
      throw new Error("La feuille de calcul n'a pas pu être ouverte. Veuillez vérifier l'ID enregistré ou les permissions.");
  }
  return ss;
}

function setSpreadsheetId(ssId) {
    PropertiesService.getScriptProperties().setProperty(SPREADSHEET_ID_KEY, ssId);
}

function isSetupNeeded() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.COLLABORATORS);
    if (!sheet) {
        return true;
    }
    return sheet.getLastRow() <= 1; 
  } catch (e) {
      if (e.message.includes('ID de la base de données n\'a pas été configuré') || e.message.includes('La feuille de calcul n\'a pas pu être ouverte')) {
          return true;
      }
      throw e;
  }
}

function initializeDatabaseStructure(ss) {
    let collabSheet = ss.getSheetByName(SHEET_NAMES.COLLABORATORS);
    if (!collabSheet) {
        collabSheet = ss.insertSheet(SHEET_NAMES.COLLABORATORS);
    }
    if (collabSheet.getLastRow() < 1) {
        collabSheet.getRange(1, 1, 1, 7).setValues([
            ['ID_MATRICULE', 'NOM', 'PRENOM', 'EMAIL', 'CODE_CENTRE', 'ROLE', 'TOKEN']
        ]).setFontWeight('bold');
    }

    let scheduleSheet = ss.getSheetByName(SHEET_NAMES.SCHEDULES);
    if (!scheduleSheet) {
        scheduleSheet = ss.insertSheet(SHEET_NAMES.SCHEDULES);
    }
    if (scheduleSheet.getLastRow() < 1) {
        scheduleSheet.getRange(1, 1, 1, 4).setValues([
            ['CODE_CENTRE', 'HEURE_DEBUT_STD', 'HEURE_FIN_STD', 'DUREE_PAUSE']
        ]).setFontWeight('bold');
    }

    let overtimeSheet = ss.getSheetByName(SHEET_NAMES.OVERTIME);
    if (!overtimeSheet) {
        overtimeSheet = ss.insertSheet(SHEET_NAMES.OVERTIME);
    }
    if (overtimeSheet.getLastRow() < 1) {
        overtimeSheet.getRange(1, 1, 1, 12).setValues([
            ['DATE_SAISIE', 'DATE_HEURES_SUPP', 'COLLAB_MATRICULE', 'COLLAB_NOM', 'COLLAB_PRENOM', 'HEURES', 'MINUTES', 'DESCRIPTION', 'STATUT', 'DATE_VALIDATION', 'MANAGER_MATRICULE', 'MOTIF_REJET']
        ]).setFontWeight('bold');
    }
    
    const defaultSheet = ss.getSheetByName('Feuille 1') || ss.getSheetByName('Sheet1');
    if (defaultSheet && defaultSheet.getLastRow() === 0) {
        ss.deleteSheet(defaultSheet);
    }
}

// =========================================================================
// COLLABORATOR (CRUD) Logic
// =========================================================================

function generateUniqueToken() {
  return Utilities.getUuid();
}

function getCollaboratorByToken(token) {
  if (!token) return null;
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.COLLABORATORS);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const headerMap = {};
  headers.forEach((h, i) => headerMap[String(h).trim()] = i);
  if (typeof headerMap['TOKEN'] === 'undefined') return null;
  const tokenIndex = headerMap['TOKEN'];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (String(row[tokenIndex]) === String(token)) {
       return {
        matricule: row[headerMap['ID_MATRICULE']],
        nom: row[headerMap['NOM']],
        prenom: row[headerMap['PRENOM']],
        email: row[headerMap['EMAIL']],
        code_centre: row[headerMap['CODE_CENTRE']],
        role: row[headerMap['ROLE']],
        token: row[tokenIndex]
      };
    }
  }
  return null;
}

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
  const emailIndex = headerMap['EMAIL'];
  const matriculeIndex = headerMap['ID_MATRICULE'];
  const tokenIndex = headerMap['TOKEN'];
  
  const normalizedIdentifier = String(identifier).toLowerCase().trim();
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if ((String(row[emailIndex]).toLowerCase().trim() === normalizedIdentifier) || 
        (String(row[matriculeIndex]).trim() === String(identifier).trim())) {
      
      return {
        matricule: row[matriculeIndex],
        nom: row[headerMap['NOM']],
        prenom: row[headerMap['PRENOM']],
        email: row[emailIndex],
        code_centre: row[headerMap['CODE_CENTRE']],
        role: row[headerMap['ROLE']],
        token: (tokenIndex !== undefined) ? row[tokenIndex] : null
      };
    }
  }
  return null;
}

function getAllCollaborators() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.COLLABORATORS);
  const data = sheet.getDataRange().getDisplayValues(); // Utilise getDisplayValues pour tout avoir en String
  const headers = data.shift();
  
  const collaborators = [];
  const headerMap = {};
  headers.forEach((h, i) => headerMap[String(h).trim()] = i);
  const tokenIndex = headerMap['TOKEN'];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    collaborators.push({
      matricule: String(row[headerMap['ID_MATRICULE']]).trim(), // Force String + Trim
      nom: row[headerMap['NOM']],
      prenom: row[headerMap['PRENOM']],
      email: row[headerMap['EMAIL']],
      code_centre: String(row[headerMap['CODE_CENTRE']]).trim(), // Force String + Trim
      role: row[headerMap['ROLE']],
      token: (tokenIndex !== undefined) ? row[tokenIndex] : null
    });
  }
  return collaborators;
}

function createCollaborator(collabData) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.COLLABORATORS);
  const newToken = generateUniqueToken();
  sheet.appendRow([
    collabData.matricule,
    collabData.nom,
    collabData.prenom,
    collabData.email,
    collabData.code_centre,
    collabData.role,
    newToken 
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
  const tokenIndex = headerMap['TOKEN']; 
  
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][matriculeIndex]) == String(collabData.matricule)) {
      const rowIndex = i + 2;
      let currentToken = '';
      if (tokenIndex !== undefined) {
         currentToken = data[i][tokenIndex];
      }
      if (!currentToken) {
          currentToken = generateUniqueToken();
          if (tokenIndex !== undefined) {
             sheet.getRange(rowIndex, tokenIndex + 1).setValue(currentToken);
          }
      }

      const rowToUpdate = [
        collabData.matricule,
        collabData.nom,
        collabData.prenom,
        collabData.email,
        collabData.code_centre,
        collabData.role,
        currentToken
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
      const rowIndex = i + 2; 
      sheet.deleteRow(rowIndex);
      return true;
    }
  }
  return false;
}

// =========================================================================
// SCHEDULES & OVERTIME (CRUD)
// =========================================================================

function getRefSchedule(codeCentre) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.SCHEDULES);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const headerMap = {};
  headers.forEach((h, i) => headerMap[String(h).trim()] = i);
  const centreIndex = headerMap['CODE_CENTRE'];
  const target = String(codeCentre).trim().toLowerCase();
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (String(row[centreIndex]).trim().toLowerCase() === target) {
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

function updateRefSchedule(scheduleData) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.SCHEDULES);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const headerMap = {};
  headers.forEach((h, i) => headerMap[String(h).trim()] = i);
  const centreIndex = headerMap['CODE_CENTRE'];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (String(row[centreIndex]) === String(scheduleData.codeCentre)) {
      const rowIndex = i + 2; 
      sheet.getRange(rowIndex, headerMap['HEURE_DEBUT_STD'] + 1).setValue(scheduleData.startTime);
      sheet.getRange(rowIndex, headerMap['HEURE_FIN_STD'] + 1).setValue(scheduleData.endTime);
      sheet.getRange(rowIndex, headerMap['DUREE_PAUSE'] + 1).setValue(scheduleData.pauseDurationMinutes);
      return true;
    }
  }
  return false;
}

function deleteRefSchedule(codeCentre) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.SCHEDULES);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const headerMap = {};
  headers.forEach((h, i) => headerMap[String(h).trim()] = i);
  const centreIndex = headerMap['CODE_CENTRE'];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (String(row[centreIndex]) === String(codeCentre)) {
      const rowIndex = i + 2; 
      sheet.deleteRow(rowIndex);
      return true;
    }
  }
  return false;
}

function getAllRefSchedules() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.SCHEDULES);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const schedules = [];
  const headerMap = {};
  headers.forEach((h, i) => headerMap[String(h).trim()] = i);
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    schedules.push({
      codeCentre: row[headerMap['CODE_CENTRE']],
      startTime: row[headerMap['HEURE_DEBUT_STD']],
      endTime: row[headerMap['HEURE_FIN_STD']],
      pauseDurationMinutes: row[headerMap['DUREE_PAUSE']]
    });
  }
  return schedules;
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

/**
 * MODIFIÉ : Ajout du formatage de Date pour éviter l'erreur de transport.
 */
function getOvertimeHistory(matricule) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.OVERTIME);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const history = [];
  const headerMap = {};
  headers.forEach((h, i) => headerMap[String(h).trim()] = i);
  const matriculeIndex = headerMap['COLLAB_MATRICULE'];
  
  const targetMatricule = String(matricule).trim().toUpperCase();
  const timeZone = ss.getSpreadsheetTimeZone(); // Nécessaire pour le formatage

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (String(row[matriculeIndex]).trim().toUpperCase() === targetMatricule) {
      // CORRECTION DATE ICI
      let rawDate = row[headerMap['DATE_HEURES_SUPP']];
      let dateStr = "";
      if (rawDate instanceof Date) {
          dateStr = Utilities.formatDate(rawDate, timeZone, "dd/MM/yyyy");
      } else {
          dateStr = String(rawDate);
      }

      history.push({
        row_id: i + 2,
        date_supp: dateStr, // Date formatée en texte
        hours: row[headerMap['HEURES']],
        minutes: row[headerMap['MINUTES']],
        description: row[headerMap['DESCRIPTION']],
        status: row[headerMap['STATUT']],
        rejectionReason: row[headerMap['MOTIF_REJET']] || null
      });
    }
  }
  // Tri sur la date (string -> date obj pour le tri uniquement)
  history.sort((a, b) => {
     // Conversion rapide dd/mm/yyyy pour le tri
     const parseDate = (d) => {
         if (!d) return 0;
         const parts = d.split('/');
         return new Date(parts[2], parts[1]-1, parts[0]).getTime();
     };
     return parseDate(b.date_supp) - parseDate(a.date_supp);
  });
  
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
  
  const clean = (val) => String(val || '').trim().toUpperCase();
  const targetCentre = clean(managerCodeCentre);

  const allCollaborators = getAllCollaborators(); 
  const centreCollaborators = allCollaborators.filter(c => clean(c.code_centre) === targetCentre);
  const validMatricules = centreCollaborators.map(c => clean(c.matricule));

  const timeZone = ss.getSpreadsheetTimeZone();

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const matricule = clean(row[headerMap['COLLAB_MATRICULE']]);
    const status = clean(row[statusIndex]);

    if (status === 'EN_ATTENTE' && validMatricules.includes(matricule)) {
      let rawDate = row[headerMap['DATE_HEURES_SUPP']];
      let dateStr = "";
      if (rawDate instanceof Date) {
          dateStr = Utilities.formatDate(rawDate, timeZone, "dd/MM/yyyy");
      } else {
          dateStr = String(rawDate);
      }

      pending.push({
        row_id: i + 2,
        date_supp: dateStr, 
        matricule: row[headerMap['COLLAB_MATRICULE']],
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

function getCollaboratorStats(matricule) {
  const history = getOvertimeHistory(matricule);
  const now = new Date();
  let stats = { weeklyMinutes: 0, monthlyMinutes: 0, yearlyMinutes: 0 };
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDay();
  const diff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
  const startOfWeek = new Date(now.setDate(diff));
  startOfWeek.setHours(0,0,0,0);

  history.forEach(entry => {
    if (entry.status === 'REJETE') return;
    
    // Parsing date manuelle car format string dd/MM/yyyy
    const parts = entry.date_supp.split('/');
    const entryDate = new Date(parts[2], parts[1]-1, parts[0]);
    
    const totalEntryMinutes = (parseInt(entry.hours) * 60) + parseInt(entry.minutes);
    if (entryDate.getFullYear() === currentYear) {
      stats.yearlyMinutes += totalEntryMinutes;
      if (entryDate.getMonth() === currentMonth) {
        stats.monthlyMinutes += totalEntryMinutes;
      }
      if (entryDate >= startOfWeek) {
        stats.weeklyMinutes += totalEntryMinutes;
      }
    }
  });

  const formatTime = (totalMin) => {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return { h: h, m: m, text: `${h}h ${m}min` };
  };

  return {
    weekly: formatTime(stats.weeklyMinutes),
    monthly: formatTime(stats.monthlyMinutes),
    yearly: formatTime(stats.yearlyMinutes)
  };
}