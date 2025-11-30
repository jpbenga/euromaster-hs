/**
 * Code.gs
 * Global entry points.
 */

/**
 * Main function that runs when the web app is accessed.
 * MODIFIÉ pour gérer le token en paramètre URL.
 */
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('index');
  
  // Extraction du token s'il existe dans l'URL (?token=XYZ)
  const token = e.parameter.token || '';
  template.initialToken = token;

  const html = template.evaluate();
  html.setTitle('Euromaster HS Manager');
  html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); 
  return html;
}

/**
 * Includes HTML files for templating.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Utility to get the email of the user accessing the app.
 * NOTE: Avec executeAs USER_DEPLOYING, ceci retournera l'email de l'admin (vous), 
 * sauf si c'est un manager connecté à son propre compte Google.
 */
function getEffectiveUserEmail() {
  try {
    return Session.getEffectiveUser().getEmail(); 
  } catch (e) {
    Logger.log("Error getting effective user email: " + e.toString());
    return '';
  }
}