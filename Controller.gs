/**
 * Controller.gs
 * Contains business logic and bridges Frontend with Database.
 */

/**
 * Validates a user login attempt.
 * @param {string} identifier - Email or Matricule
 */
function loginUser(identifier) {
  const user = getCollaborator(identifier);
  if (!user) {
    throw new Error('Utilisateur non trouvé.');
  }
  return user;
}

/**
 * Calculates overtime duration based on reference schedule.
 * @param {string} startTime - HH:mm
 * @param {string} endTime - HH:mm
 * @param {string} codeCentre - Centre code to fetch reference hours
 */
function calculateOvertimeDuration(startTime, endTime, codeCentre) {
  // Simple calculation for now: End - Start
  // In real implementation, we would subtract standard hours and breaks based on codeCentre
  
  const start = new Date('1970-01-01T' + startTime + 'Z');
  const end = new Date('1970-01-01T' + endTime + 'Z');
  
  let diffMs = end - start;
  if (diffMs < 0) {
    // Handle overnight shifts if necessary, or throw error
    throw new Error('L\'heure de fin doit être après l\'heure de début.');
  }
  
  const diffHrs = diffMs / (1000 * 60 * 60);
  return diffHrs.toFixed(2);
}

/**
 * Submits an overtime claim.
 */
function submitOvertime(formObject) {
  try {
    const duration = calculateOvertimeDuration(formObject.startTime, formObject.endTime, formObject.codeCentre);
    
    const entry = {
      matricule: formObject.matricule,
      date: formObject.date,
      startTime: formObject.startTime,
      endTime: formObject.endTime,
      duration: duration,
      reason: formObject.reason
    };
    
    const id = logOvertime(entry);
    
    // Send email notification to Manager (Mocked)
    // MailApp.sendEmail(...)
    
    return { success: true, id: id };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Approves or Rejects an entry.
 */
function processValidation(entryId, action, reason) {
  const managerEmail = getEffectiveUserEmail();
  const status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  
  const success = updateStatus(entryId, status, managerEmail, reason);
  
  if (success) {
    // Notify collaborator
  }
  
  return success;
}
