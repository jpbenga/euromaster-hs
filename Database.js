/**
 * Database.gs
 * Handles all interactions with the Google Sheet.
 */

// CONFIGURATION
// Replace with the actual Spreadsheet ID after creation
const SPREADSHEET_ID = '1WeEVJ2NejhBw6ICHaDgdpzXdhXUYu3t4YfYA6dy0FzI'; 

const SHEET_NAMES = {
  COLLABORATORS: 'COLLABORATEURS',
  SCHEDULES: 'HORAIRES_REF',
  ENTRIES: 'SAISIES_HS'
};

/**
 * Connects to the spreadsheet.
 */
function getSpreadsheet() {
  // CORRECTION : Suppression de la condition IF qui levait l'erreur
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * Fetches a collaborator by Email or Matricule.
 * @param {string} identifier - Email or Matricule
 * @return {Object|null} Collaborator object or null if not found
 */
function getCollaborator(identifier) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.COLLABORATORS);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift(); // Remove headers
  
  // Columns: ID_MATRICULE, NOM, PRENOM, EMAIL, CODE_CENTRE, ROLE
  const emailIndex = headers.indexOf('EMAIL');
  const matriculeIndex = headers.indexOf('ID_MATRICULE');
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (row[emailIndex] === identifier || row[matriculeIndex] == identifier) {
      return {
        matricule: row[headers.indexOf('ID_MATRICULE')],
        nom: row[headers.indexOf('NOM')],
        prenom: row[headers.indexOf('PRENOM')],
        email: row[headers.indexOf('EMAIL')],
        code_centre: row[headers.indexOf('CODE_CENTRE')],
        role: row[headers.indexOf('ROLE')]
      };
    }
  }
  return null;
}

/**
 * Logs a new overtime entry.
 * @param {Object} entryData
 */
function logOvertime(entryData) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.ENTRIES);
  
  // ID_SAISIE, MATRICULE, DATE_HS, HEURE_DEBUT_REELLE, HEURE_FIN_REELLE, DUREE_CALCULEE, STATUT_COLLAB, STATUT_MANAGER, EMAIL_MANAGER, MOTIF, DATE_VALIDATION
  const id = Utilities.getUuid();
  const timestamp = new Date();
  
  sheet.appendRow([
    id,
    entryData.matricule,
    entryData.date,
    entryData.startTime,
    entryData.endTime,
    entryData.duration,
    'VALIDATED_BY_COLLAB', // Auto-validated by collab as per requirements (Approche 1)
    'PENDING',
    '', // Manager email (filled later)
    entryData.reason,
    '' // Validation date
  ]);
  
  return id;
}

/**
 * Gets overtime history for a specific collaborator.
 */
function getOvertimeHistory(matricule) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.ENTRIES);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  const matriculeIndex = headers.indexOf('MATRICULE');
  const history = [];
  
  for (let i = 0; i < data.length; i++) {
    if (data[i][matriculeIndex] == matricule) {
      history.push({
        id: data[i][headers.indexOf('ID_SAISIE')],
        date: data[i][headers.indexOf('DATE_HS')],
        duration: data[i][headers.indexOf('DUREE_CALCULEE')],
        statusManager: data[i][headers.indexOf('STATUT_MANAGER')],
        motif: data[i][headers.indexOf('MOTIF')]
      });
    }
  }
  return history;
}

/**
 * Gets pending approvals for a manager (based on centre or all for now).
 * Assuming Manager sees all for the pilot or filtered by centre if we implement that logic.
 */
function getPendingApprovals(managerCodeCentre) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.ENTRIES);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  // We might need to join with Collaborators to filter by centre if needed
  // For now, returning all PENDING
  
  const statusIndex = headers.indexOf('STATUT_MANAGER');
  const pending = [];
  
  for (let i = 0; i < data.length; i++) {
    if (data[i][statusIndex] === 'PENDING') {
      pending.push({
        id: data[i][headers.indexOf('ID_SAISIE')],
        matricule: data[i][headers.indexOf('MATRICULE')],
        date: data[i][headers.indexOf('DATE_HS')],
        duration: data[i][headers.indexOf('DUREE_CALCULEE')],
        motif: data[i][headers.indexOf('MOTIF')]
      });
    }
  }
  return pending;
}

/**
 * Updates the status of an entry (Approve/Reject).
 */
function updateStatus(entryId, newStatus, managerEmail, rejectionReason) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.ENTRIES);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift(); // headers are not in data array for loop if we use getValues() on range excluding header, but here we used getDataRange so headers are row 0
  
  // Actually getDataRange includes headers.
  // Let's find the row by ID.
  
  const idIndex = headers.indexOf('ID_SAISIE');
  
  for (let i = 0; i < data.length; i++) {
    if (data[i][idIndex] === entryId) {
      // Row index in sheet is i + 2 (1 for header, 1 for 0-based index)
      const rowIndex = i + 2;
      
      const statusCol = headers.indexOf('STATUT_MANAGER') + 1;
      const emailCol = headers.indexOf('EMAIL_MANAGER') + 1;
      const dateCol = headers.indexOf('DATE_VALIDATION') + 1;
      
      sheet.getRange(rowIndex, statusCol).setValue(newStatus);
      sheet.getRange(rowIndex, emailCol).setValue(managerEmail);
      sheet.getRange(rowIndex, dateCol).setValue(new Date());
      
      if (newStatus === 'REJECTED' && rejectionReason) {
          // Gérer le motif de refus selon les colonnes existantes
      }
      return true;
    }
  }
  return false;
}