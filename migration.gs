/**
 * Migration.gs
 * Script utilitaire pour mettre à jour la structure de la base de données existante.
 * INSTRUCTIONS :
 * 1. Collez ce code dans un fichier.
 * 2. Sélectionnez la fonction 'runDatabaseMigration' dans la barre d'outils en haut.
 * 3. Cliquez sur "Exécuter".
 * 4. Une fois terminé, vérifiez votre Google Sheet (colonne G ajoutée).
 */

function runDatabaseMigration() {
  // Récupération de l'ID de la Spreadsheet via les propriétés du script
  const ssId = PropertiesService.getScriptProperties().getProperty('EUROMAS_HS_SPREADSHEET_ID');
  
  if (!ssId) {
    Logger.log("ERREUR : Aucun ID de base de données trouvé. Avez-vous effectué la configuration initiale (Setup) ?");
    return;
  }
  
  let ss;
  try {
    ss = SpreadsheetApp.openById(ssId);
  } catch(e) {
    Logger.log("ERREUR : Impossible d'ouvrir la feuille de calcul. Vérifiez vos permissions ou l'ID.");
    return;
  }

  const sheet = ss.getSheetByName('COLLABORATEURS');
  if (!sheet) {
    Logger.log("ERREUR : L'onglet 'COLLABORATEURS' est introuvable.");
    return;
  }
  
  // 1. ANALYSE DES EN-TÊTES
  // On lit la première ligne pour voir si TOKEN existe déjà
  const lastCol = sheet.getLastColumn();
  // Gestion du cas où la feuille serait vide (juste headers)
  if (lastCol < 1) {
     Logger.log("La feuille semble vide.");
     return;
  }

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  let tokenColIndex = headers.indexOf('TOKEN');
  
  // 2. CRÉATION DE LA COLONNE SI MANQUANTE
  if (tokenColIndex === -1) {
    Logger.log("Colonne TOKEN manquante. Création en cours...");
    
    // On écrit "TOKEN" dans la colonne suivant la dernière
    const newColIndex = lastCol + 1;
    sheet.getRange(1, newColIndex).setValue('TOKEN').setFontWeight('bold');
    
    // On met à jour l'index pour la suite
    tokenColIndex = newColIndex - 1; // Index base 0 pour les tableaux JS
  } else {
    Logger.log("Colonne TOKEN déjà présente (Index: " + tokenColIndex + ").");
  }
  
  // 3. GÉNÉRATION DES TOKENS POUR LES UTILISATEURS EXISTANTS
  const lastRow = sheet.getLastRow();
  
  // S'il y a des données (plus que la ligne d'en-tête)
  if (lastRow > 1) {
    // On récupère toute la colonne TOKEN (à partir de la ligne 2)
    // tokenColIndex + 1 car getRange utilise base 1
    const dataRange = sheet.getRange(2, tokenColIndex + 1, lastRow - 1, 1);
    const currentValues = dataRange.getValues();
    let updatedCount = 0;
    
    // On prépare les nouvelles valeurs
    const newValues = currentValues.map(row => {
      const currentToken = row[0];
      // Si la cellule est vide ou nulle, on génère un UUID
      if (!currentToken || currentToken === '') {
        updatedCount++;
        return [Utilities.getUuid()]; 
      }
      return [currentToken]; // Sinon on garde l'existant
    });
    
    // Si on a généré de nouveaux tokens, on écrit tout d'un coup
    if (updatedCount > 0) {
      dataRange.setValues(newValues);
      Logger.log(`SUCCÈS : ${updatedCount} tokens ont été générés et sauvegardés.`);
    } else {
      Logger.log("Aucune mise à jour nécessaire : tous les utilisateurs ont déjà un token.");
    }
  } else {
    Logger.log("Aucun utilisateur trouvé dans la base (seuls les en-têtes sont présents).");
  }
}