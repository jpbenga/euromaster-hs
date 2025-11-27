# Euromaster Overtime Management System (GAS Edition)

## Overview
This project is a Google Apps Script web application designed to manage overtime hours for Euromaster centers. It uses Google Sheets as a database and provides a web interface for Collaborators to submit hours and Managers to validate them.

## Deployment Instructions

### 1. Create Google Sheet
1. Create a new Google Sheet.
2. Rename the sheet tabs to exactly:
   - `COLLABORATEURS`
   - `HORAIRES_REF`
   - `SAISIES_HS`
3. **Setup Columns**:
   - **COLLABORATEURS**: `ID_MATRICULE`, `NOM`, `PRENOM`, `EMAIL`, `CODE_CENTRE`, `ROLE` (ROLE can be 'COLLABORATOR' or 'MANAGER')
   - **HORAIRES_REF**: `CODE_CENTRE`, `HEURE_DEBUT_STD`, `HEURE_FIN_STD`, `DUREE_PAUSE`
   - **SAISIES_HS**: `ID_SAISIE`, `MATRICULE`, `DATE_HS`, `HEURE_DEBUT_REELLE`, `HEURE_FIN_REELLE`, `DUREE_CALCULEE`, `STATUT_COLLAB`, `STATUT_MANAGER`, `EMAIL_MANAGER`, `MOTIF`, `DATE_VALIDATION`

### 2. Create Google Apps Script Project
1. Open the Google Sheet.
2. Go to **Extensions > Apps Script**.
3. Copy the contents of the files in this repository into the Apps Script editor:
   - `Code.gs` -> `Code.gs`
   - `Database.gs` -> `Database.gs`
   - `Controller.gs` -> `Controller.gs`
   - `index.html` -> `index.html`
   - `styles.html` -> `styles.html`
   - `scripts.html` -> `scripts.html`
   - `collaborator.html` -> `collaborator.html`
   - `manager.html` -> `manager.html`

### 3. Configuration
1. In `Database.gs`, find the line `const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';`.
2. Replace `'YOUR_SPREADSHEET_ID_HERE'` with the actual ID of your Google Sheet (found in the URL between `/d/` and `/edit`).

### 4. Deploy
1. Click **Deploy > New deployment**.
2. Select **Type: Web app**.
3. **Execute as**: `User accessing the web app` (Important for capturing their email).
4. **Who has access**: `Anyone within [Your Domain]` or `Anyone with Google Account` depending on policy.
5. Click **Deploy**.
6. Share the generated URL with users.

## Usage
- **Collaborators**: Access the URL, log in with Email/Matricule (must match Sheet), submit hours.
- **Managers**: Access the URL, log in, view pending approvals, approve/reject.

## Architecture
- **Frontend**: HTML5, CSS3, Vanilla JS (hosted by GAS HTML Service).
- **Backend**: Google Apps Script.
- **Database**: Google Sheets.
