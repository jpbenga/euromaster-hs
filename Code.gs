/**
 * Code.gs
 * Global entry points.
 */

/**
 * Main function that runs when the web app is accessed.
 */
function doGet() {
  const template = HtmlService.createTemplateFromFile('index');
  const html = template.evaluate();
  html.setTitle('Euromaster HS Manager');
  // Autoriser l'affichage dans Google Workspace ou dans des iframes.
  html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); 
  return html;
}

/**
 * Includes HTML files for templating.
 * @param {string} filename - The name of the HTML file to include.
 * @return {string} The content of the HTML file.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Utility to get the email of the user accessing the app.
 * @return {string} The email of the effective user.
 */
function getEffectiveUserEmail() {
  try {
    // Si l'application est déployée sous 'User accessing the web app', ceci retourne l'email de l'utilisateur connecté.
    return Session.getEffectiveUser().getEmail(); 
  } catch (e) {
    Logger.log("Error getting effective user email: " + e.toString());
    return '';
  }
}