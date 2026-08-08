/**
 * Joy's Food — email relay.
 *
 * Paste this into script.google.com signed in as vijaykumarcirigimi@gmail.com,
 * then deploy it as a Web App. The Next.js app POSTs order JSON here and this
 * sends the mail from that Gmail account.
 *
 * ── Setup ──────────────────────────────────────────────────────────────────
 * 1. script.google.com → New project → paste this over Code.gs.
 * 2. Project Settings → Script Properties → add:
 *        SHARED_SECRET   a long random string
 *        KITCHEN_EMAIL   where new-order alerts go (your own address)
 * 3. Deploy → New deployment → type "Web app":
 *        Execute as:      Me (vijaykumarcirigimi@gmail.com)
 *        Who has access:  Anyone
 * 4. Authorise when prompted — it needs permission to send mail as you.
 * 5. Copy the /exec URL into .env.local as APPS_SCRIPT_EMAIL_URL, and the same
 *    secret as APPS_SCRIPT_EMAIL_SECRET.
 *
 * ── Why the shared secret is not optional ──────────────────────────────────
 * "Who has access: Anyone" is required — Google will not let an unauthenticated
 * server POST otherwise — and it means the URL is world-callable. Anyone who
 * learns it could otherwise make your Gmail send arbitrary mail to arbitrary
 * people, from your real address. Every request is therefore rejected unless it
 * carries the secret, compared in a way that does not leak length by timing.
 *
 * ── Quota ──────────────────────────────────────────────────────────────────
 * A consumer Gmail account can send to roughly 100 recipients a day through
 * Apps Script. Ample for a home kitchen; if you outgrow it, move to a real
 * transactional provider rather than raising this.
 */

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    if (!secretMatches(body.secret)) {
      return json({ ok: false, error: "unauthorised" });
    }

    var kind = String(body.kind || "");
    var order = body.order || {};

    if (!order.orderNumber) {
      return json({ ok: false, error: "missing order" });
    }

    var sent = [];

    // The customer only gets mail if they gave us an address.
    if (order.customerEmail) {
      var built = kind === "cancelled" ? cancelledEmail(order) : confirmedEmail(order);
      GmailApp.sendEmail(order.customerEmail, built.subject, built.text, {
        name: "Joy's Food",
        htmlBody: built.html,
      });
      sent.push("customer");
    }

    // The kitchen alert is the one that actually has to arrive — an order
    // nobody notices is worse than a confirmation nobody receives.
    var kitchen = PropertiesService.getScriptProperties().getProperty("KITCHEN_EMAIL");
    if (kitchen && kind !== "cancelled") {
      GmailApp.sendEmail(kitchen, "New order " + order.orderNumber, kitchenText(order), {
        name: "Joy's Food orders",
      });
      sent.push("kitchen");
    } else if (kitchen && kind === "cancelled") {
      GmailApp.sendEmail(kitchen, "CANCELLED " + order.orderNumber, kitchenText(order), {
        name: "Joy's Food orders",
      });
      sent.push("kitchen");
    }

    return json({ ok: true, sent: sent });
  } catch (err) {
    // Logged to the Apps Script execution log, not returned: an error string
    // can carry details the caller has no business seeing.
    console.error(err);
    return json({ ok: false, error: "failed" });
  }
}

/** A GET is someone checking the deployment is live. Never sends anything. */
function doGet() {
  return json({ ok: true, service: "joysfood email relay", method: "POST only" });
}

function secretMatches(given) {
  var expected = PropertiesService.getScriptProperties().getProperty("SHARED_SECRET");
  if (!expected || !given) return false;
  if (given.length !== expected.length) return false;
  // Constant-time-ish compare: always walks the whole string.
  var diff = 0;
  for (var i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  }
  return diff === 0;
}

function json(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function itemLines(order) {
  return (order.items || [])
    .map(function (i) {
      return "  " + i.name + " x " + i.quantity + "   " + i.total;
    })
    .join("\n");
}

function confirmedEmail(order) {
  var when = order.slot ? order.day + ", " + order.slot : order.day;
  var subject = "Order confirmed — " + order.orderNumber;

  var text =
    "Hi " + order.customerName.split(" ")[0] + ",\n\n" +
    "We've got your order and it's confirmed.\n\n" +
    "Order:    " + order.orderNumber + "\n" +
    "When:     " + when + "\n" +
    (order.fulfilmentType === "delivery"
      ? "Delivery: " + (order.deliveryAddress || "") + "\n"
      : "Pickup:   from the kitchen\n") +
    "\n" + itemLines(order) + "\n\n" +
    "Total:    " + order.total + "\n" +
    order.paymentLine + "\n\n" +
    "Track or cancel your order:\n" + order.orderUrl + "\n\n" +
    "Joy's Food\n";

  var html =
    "<div style=\"font-family:system-ui,sans-serif;max-width:520px;color:#221c15\">" +
    "<h2 style=\"color:#e2571e;margin:0 0 4px\">Joy&rsquo;s Food</h2>" +
    "<p>Hi " + esc(order.customerName.split(" ")[0]) + ", we&rsquo;ve got your order and it&rsquo;s confirmed.</p>" +
    "<p style=\"font-family:monospace;background:#fdf0e2;padding:8px 12px;border-radius:8px;display:inline-block\">" +
    esc(order.orderNumber) + "</p>" +
    "<p><strong>" + esc(when) + "</strong><br>" +
    (order.fulfilmentType === "delivery"
      ? esc(order.deliveryAddress || "Delivery")
      : "Pickup from the kitchen") + "</p>" +
    "<table style=\"border-collapse:collapse;width:100%\">" +
    (order.items || [])
      .map(function (i) {
        return (
          "<tr><td style=\"padding:4px 0\">" + esc(i.name) +
          " &times; " + i.quantity + "</td><td align=\"right\">" + esc(i.total) + "</td></tr>"
        );
      })
      .join("") +
    "<tr><td style=\"padding-top:8px;border-top:1px solid #f1e8dd\"><strong>Total</strong></td>" +
    "<td align=\"right\" style=\"padding-top:8px;border-top:1px solid #f1e8dd\"><strong>" +
    esc(order.total) + "</strong></td></tr></table>" +
    "<p style=\"color:#7c7268\">" + esc(order.paymentLine) + "</p>" +
    "<p><a href=\"" + esc(order.orderUrl) + "\" style=\"color:#e2571e\">Track or cancel your order</a></p>" +
    "</div>";

  return { subject: subject, text: text, html: html };
}

function cancelledEmail(order) {
  var subject = "Order cancelled — " + order.orderNumber;
  var text =
    "Hi " + order.customerName.split(" ")[0] + ",\n\n" +
    "Your order " + order.orderNumber + " has been cancelled.\n\n" +
    order.paymentLine + "\n\n" +
    order.orderUrl + "\n\nJoy's Food\n";
  var html =
    "<div style=\"font-family:system-ui,sans-serif;max-width:520px;color:#221c15\">" +
    "<h2 style=\"color:#e2571e;margin:0 0 4px\">Joy&rsquo;s Food</h2>" +
    "<p>Your order <strong>" + esc(order.orderNumber) + "</strong> has been cancelled.</p>" +
    "<p style=\"color:#7c7268\">" + esc(order.paymentLine) + "</p></div>";
  return { subject: subject, text: text, html: html };
}

function kitchenText(order) {
  return (
    order.orderNumber + "\n" +
    (order.day || "") + " " + (order.slot || "") + "\n" +
    order.customerName + "  " + order.customerPhone + "\n" +
    (order.fulfilmentType === "delivery"
      ? "DELIVERY: " + (order.deliveryAddress || "")
      : "PICKUP") + "\n\n" +
    itemLines(order) + "\n\n" +
    "Total " + order.total + "\n" +
    (order.notes ? "Notes: " + order.notes + "\n" : "") +
    order.paymentLine + "\n"
  );
}

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
