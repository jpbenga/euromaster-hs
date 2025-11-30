function checkTeamConsistency() {
  const ssId = PropertiesService.getScriptProperties().getProperty('EUROMAS_HS_SPREADSHEET_ID');
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName('COLLABORATEURS');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift(); // Enlever l'en-tête
  
  // Index des colonnes (Attention à l'ordre dans votre fichier)
  const matIndex = headers.indexOf('ID_MATRICULE');
  const centreIndex = headers.indexOf('CODE_CENTRE');
  const emailIndex = headers.indexOf('EMAIL');
  const roleIndex = headers.indexOf('ROLE');
  
  // 1. Qui lance le script ? (Simule le Manager)
  const myEmail = Session.getActiveUser().getEmail();
  Logger.log("🕵️‍♂️ Utilisateur actuel (Vous) : " + myEmail);
  
  let myProfile = null;
  let targetCollab = null;
  const targetMatricule = 'cgovlv12'; // Le matricule vu dans vos logs précédents
  
  data.forEach(row => {
    // Recherche du Manager (Vous)
    if (String(row[emailIndex]).toLowerCase() === myEmail.toLowerCase()) {
      myProfile = { matricule: row[matIndex], code: row[centreIndex], role: row[roleIndex] };
    }
    // Recherche du Collaborateur (celui qui a fait la saisie)
    if (String(row[matIndex]).toLowerCase() === targetMatricule.toLowerCase()) {
      targetCollab = { matricule: row[matIndex], code: row[centreIndex] };
    }
  });
  
  // RÉSULTATS
  if (!myProfile) {
    Logger.log("❌ ERREUR : Je ne vous trouve pas dans la liste des collaborateurs avec l'email " + myEmail);
    return;
  }
  
  Logger.log(`👤 VOTRE PROFIL : Role=${myProfile.role} | Centre='${myProfile.code}'`);
  
  if (!targetCollab) {
    Logger.log(`❌ ERREUR : Le collaborateur ${targetMatricule} est introuvable dans l'onglet COLLABORATEURS.`);
    Logger.log("   -> C'est pour ça que vous ne voyez pas ses heures. Créez-le ou corrigez son matricule.");
    return;
  }
  
  Logger.log(`👷 PROFIL COLLAB (${targetMatricule}) : Centre='${targetCollab.code}'`);
  
  // VERDICT
  if (String(myProfile.code).trim() === String(targetCollab.code).trim()) {
     Logger.log("✅ SUCCÈS : Les codes correspondent ! Si vous ne voyez rien, vérifiez que le statut dans SAISIES_HS est bien 'EN_ATTENTE'.");
  } else {
     Logger.log("⛔ ÉCHEC : Les codes centres sont différents !");
     Logger.log(`   -> Manager: '${myProfile.code}' vs Collab: '${targetCollab.code}'`);
     Logger.log("   -> CORRECTION : Modifiez l'une des deux cases dans le Sheet pour qu'elles soient identiques.");
  }
}