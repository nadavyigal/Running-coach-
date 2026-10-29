/**
 * RunSmart beta registrations -> Google Sheet.
 *
 * Paste into the sheet's Apps Script editor (Extensions > Apps Script).
 * Setup steps: docs/beta/README.md.
 *
 * The web app at www.runsmart-ai.com/api/beta/register POSTs:
 *   { "secret": "<BETA_SHEET_WEBHOOK_SECRET>", "row": { "submitted_at": "...", "full_name": "...", ... } }
 * Each key in "row" matches a header in row 1. Columns the page does not send
 * (group, invite_code, status, status_updated, notes) stay empty for the founder.
 */

// Opened by id: web-app runs do not reliably have an "active" spreadsheet.
var SPREADSHEET_ID = '10w2yrMINJvIWNGstlb5-doeySJFFoiNVv5JlVaxLhZc'; // "RunSmart Beta Registrations"
var SHEET_NAME = ''; // Empty = first tab. Set a tab name if registrations live on another tab.

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var expected = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');

    if (!expected || body.secret !== expected) {
      return json_({ ok: false, error: 'unauthorized' });
    }
    if (!body.row || typeof body.row !== 'object') {
      return json_({ ok: false, error: 'missing row' });
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
      var sheet = SHEET_NAME ? spreadsheet.getSheetByName(SHEET_NAME) : spreadsheet.getSheets()[0];
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      var row = headers.map(function (header) {
        var value = body.row[String(header).trim()];
        return value === undefined || value === null ? '' : asText_(String(value));
      });
      sheet.appendRow(row);
    } finally {
      lock.releaseLock();
    }

    return json_({ ok: true });
  } catch (error) {
    return json_({ ok: false, error: 'server error' });
  }
}

// Stops a value like "=HYPERLINK(...)" from running as a formula in the sheet.
function asText_(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
