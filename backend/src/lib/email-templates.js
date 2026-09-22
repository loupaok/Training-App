const BRAND_COLOR = '#e74c3c';
const APP_NAME = process.env.EMAIL_FROM_NAME || 'CoachApp';

function wrapEmail(bodyHtml, cta) {
  return `
<div style="background:#f5f6fa;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
    <div style="padding:32px;color:#1f2430;line-height:1.6;">
      ${bodyHtml}
      ${cta ? `<div style="margin-top:24px;"><a href="${cta.url}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 24px;font-weight:600;">${cta.text}</a></div>` : ''}
    </div>
    <div style="padding:16px 32px;background:#f5f6fa;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9aa0a6;">${APP_NAME}</p>
    </div>
  </div>
</div>`;
}

export function updateNotificationEmail(clientName, weight, trainingScore, nutritionScore, updateUrl) {
  const stats = [];
  if (weight !== null && weight !== undefined) stats.push(`⚖️ Βάρος: <strong>${weight}kg</strong>`);
  if (trainingScore !== null && trainingScore !== undefined) stats.push(`🏋️ Προπόνηση: <strong>${trainingScore}/5</strong>`);
  if (nutritionScore !== null && nutritionScore !== undefined) stats.push(`🥗 Διατροφή: <strong>${nutritionScore}/5</strong>`);

  return {
    subject: `Νέο update από ${clientName}`,
    html: wrapEmail(
      `<p>Ο πελάτης <strong>${clientName}</strong> υπέβαλε νέο εβδομαδιαίο update.</p>` +
        (stats.length ? `<p>${stats.join(' &nbsp;·&nbsp; ')}</p>` : ''),
      { text: 'Δείτε το update', url: updateUrl }
    )
  };
}

export function updateReminderEmail(clientName, submitUrl) {
  return {
    subject: 'Είναι η ώρα του update σου! 💪',
    html: wrapEmail(
      `<p>Γεια ${clientName},</p>
       <p>Σήμερα είναι η μέρα του εβδομαδιαίου update σου. Μπες στην εφαρμογή και στείλε το!</p>
       <p>Ο coach σου σε περιμένει! 💪</p>`,
      { text: 'Στείλε Update', url: submitUrl }
    )
  };
}

export function registrationEmail(clientName) {
  return {
    subject: 'Καλώς ήρθες! Η εγγραφή σου ολοκληρώθηκε',
    html: wrapEmail(
      `<p>Γεια σου ${clientName},</p>
       <p>Η εγγραφή σου ολοκληρώθηκε με επιτυχία. Ο coach σου θα επικοινωνήσει μαζί σου εντός 24 ωρών για να επιβεβαιώσει την πληρωμή και να ενεργοποιήσει τον λογαριασμό σου.</p>`
    )
  };
}

export function subscriptionExpiryEmail(clientName, daysLeft) {
  return {
    subject: `Η συνδρομή σου λήγει σε ${daysLeft} μέρες`,
    html: wrapEmail(
      `<p>Γεια σου ${clientName},</p>
       <p>Η συνδρομή σου λήγει σε <strong>${daysLeft} μέρες</strong>. Επικοινώνησε με τον coach σου για ανανέωση.</p>`,
      { text: 'Πληρωμές & Συνδρομή', url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/client-billing` }
    )
  };
}
