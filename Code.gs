/**
 * Main entry point for the Web App.
 * Handles routing based on user role and parameters.
 */
function doGet(e) {
  var template = HtmlService.createTemplateFromFile('index');
  return template.evaluate()
      .setTitle('Euromaster HS Manager')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Helper function to include HTML fragments.
 * Used to separate CSS and JS into different files.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
      .getContent();
}

/**
 * Gets the effective user's email.
 * This is the email of the user accessing the web app.
 */
function getEffectiveUserEmail() {
  return Session.getEffectiveUser().getEmail();
}

/**
 * Gets the active user's email.
 * This might be different from effective user depending on deployment.
 * For this app, we generally rely on the user being logged in to Google Workspace.
 */
function getActiveUserEmail() {
  return Session.getActiveUser().getEmail();
}
