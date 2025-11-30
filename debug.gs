function diagnoseOvertimeIssues() {
  const ssId = PropertiesService.getScriptProperties().getProperty('EUROMAS_HS_SPREADSHEET_ID');
  if (!ssId) { Logger.log("❌ ID Spreadsheet introuvable."); return; }
  
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName('SAISIES_HS');
  
  if (!sheet) { Logger.log("❌ Onglet 'SAISIES_HS' introuvable."); return; }
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 1) { Logger.log("❌ La feuille est vide."); return; }
  
  const headers = data[0];
  Logger.log("📋 En-têtes trouvés : " + JSON.stringify(headers));
  
  // Vérification des colonnes critiques attendues par le code
  const required = ['COLLAB_MATRICULE', 'STATUT', 'DATE_HEURES_SUPP'];
  const missing = required.filter(h => !headers.includes(h));
  
  if (missing.length > 0) {
    Logger.log("❌ COLONNES MANQUANTES : Le code ne trouve pas ces colonnes exactes : " + missing.join(', '));
    Logger.log("💡 Solution : Renommez vos colonnes dans le Google Sheet pour correspondre EXACTEMENT (copiez les noms ci-dessus).");
    return;
  } else {
    Logger.log("✅ Les en-têtes semblent corrects.");
  }

  // Analyse des données
  Logger.log("🔍 Analyse des 5 dernières lignes...");
  const matriculeIndex = headers.indexOf('COLLAB_MATRICULE');
  const statusIndex = headers.indexOf('STATUT');
  
  // On regarde les données (en partant de la fin, sans l'en-tête)
  const rowsToCheck = data.slice(1).slice(-5); 
  
  rowsToCheck.forEach((row, i) => {
    Logger.log(`Ligne ${i+1}: Matricule='${row[matriculeIndex]}' | Statut='${row[statusIndex]}'`);
  });
  
  Logger.log("ℹ️ Si le Statut n'est pas strictement 'EN_ATTENTE' (attention aux espaces), il ne remontera pas.");
  Logger.log("ℹ️ Si le Matricule ici ne correspond pas exactement à celui de vos collaborateurs (onglet COLLABORATEURS), il ne remontera pas.");
}