function debugManagerView() {
  Logger.log("🚀 DÉMARRAGE DU DIAGNOSTIC MANAGER");
  
  // 1. Récupération du Manager (Vous)
  const userEmail = Session.getActiveUser().getEmail();
  const manager = getCollaborator(userEmail);
  
  if (!manager) {
    Logger.log("❌ ERREUR CRITIQUE : Vous n'êtes pas trouvé dans la liste des collaborateurs.");
    return;
  }
  
  // Nettoyage préventif pour simuler ce que fait le code
  const clean = (val) => String(val || '').trim().toUpperCase();
  const managerCentre = clean(manager.code_centre);
  
  Logger.log(`👤 Manager identifié : ${manager.prenom} ${manager.nom}`);
  Logger.log(`🏢 Code Centre du Manager (Nettoyé) : '${managerCentre}'`);
  
  // 2. Récupération de l'équipe (Collaborateurs du même centre)
  const allCollabs = getAllCollaborators();
  const team = allCollabs.filter(c => clean(c.code_centre) === managerCentre);
  
  Logger.log(`👥 Nombre total de collaborateurs dans la base : ${allCollabs.length}`);
  Logger.log(`🎯 Nombre de collaborateurs dans votre centre ('${managerCentre}') : ${team.length}`);
  
  if (team.length === 0) {
    Logger.log("❌ ERREUR : Aucun collaborateur trouvé avec le même code centre que vous.");
    Logger.log("👉 Vérifiez la colonne CODE_CENTRE dans l'onglet COLLABORATEURS.");
    return;
  }
  
  const validMatricules = team.map(c => clean(c.matricule));
  Logger.log(`📋 Matricules valides pour votre centre : [${validMatricules.join(', ')}]`);
  
  // 3. Simulation de la lecture des Validations (SAISIES_HS)
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('SAISIES_HS');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift(); // En-têtes
  
  // Recréation de la map des en-têtes (comme dans le vrai code)
  const headerMap = {};
  headers.forEach((h, i) => headerMap[String(h).trim()] = i);
  
  const matCol = headerMap['COLLAB_MATRICULE'];
  const statCol = headerMap['STATUT'];
  
  if (matCol === undefined || statCol === undefined) {
    Logger.log("❌ ERREUR : Colonnes COLLAB_MATRICULE ou STATUT introuvables dans SAISIES_HS.");
    Logger.log(`   En-têtes lus : ${JSON.stringify(headers)}`);
    return;
  }

  Logger.log("🔍 ANALYSE DES LIGNES SAISIES_HS (Seules les 'EN_ATTENTE' sont traitées) :");
  
  let foundCount = 0;
  
  data.forEach((row, i) => {
    const rawMatricule = row[matCol];
    const rawStatus = row[statCol];
    
    const matricule = clean(rawMatricule);
    const status = clean(rawStatus);
    
    // On ne loggue que si c'est EN_ATTENTE pour ne pas polluer, ou si c'est le collaborateur cible
    if (status === 'EN_ATTENTE' || matricule.includes('CGOVLV12')) {
      const isStatusOk = (status === 'EN_ATTENTE');
      const isMatriculeOk = validMatricules.includes(matricule);
      
      let verdict = "✅ VISIBLE";
      if (!isStatusOk) verdict = "⛔ MASQUÉ (Mauvais statut)";
      else if (!isMatriculeOk) verdict = "⛔ MASQUÉ (Matricule hors centre)";
      
      Logger.log(`   Ligne ${i+2}: Mat='${matricule}' | Statut='${status}' | Match Centre? ${isMatriculeOk ? 'OUI' : 'NON'} -> ${verdict}`);
      
      if (verdict.includes("VISIBLE")) foundCount++;
    }
  });
  
  Logger.log(`🏁 RÉSULTAT FINAL : ${foundCount} demande(s) devraient apparaître sur votre interface.`);
}