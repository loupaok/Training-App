import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ClientSidebar, ClientTopbar } from '../components/ClientShell';
import { api } from '../services/api';

const fallbackPackages = [
  { value: '2_months', title: '2 μήνες', price: '190€', note: 'Ιδανικό ξεκίνημα', period: '2 μήνες', features: [] },
  { value: '3_months', title: '3 μήνες', price: '270€', note: 'Σταθερή πρόοδος', period: '3 μήνες', features: [] },
  { value: '4_months', title: '4 μήνες', price: '320€', note: 'Καλύτερη αξία', period: '4 μήνες', features: [] },
];

const bankDetails = {
  beneficiary: 'KAIZEN FITNESS',
  bank: 'Eurobank',
  iban: 'GR16 0123 4567 8901 2345 6789',
  supportEmail: 'support@kaizenfitness.gr',
  supportPhone: '210 123 4567',
};

export default function ClientBilling() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dashboardMeta, setDashboardMeta] = useState({ paymentApproved: false, unreadNotifications: 0 });
  const [pricingPlans, setPricingPlans] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [pendingPayment, setPendingPayment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const plans = useMemo(() => {
    if (!pricingPlans.length) return fallbackPackages;
    return pricingPlans.map((plan) => ({
      value: plan.slug,
      title: plan.name,
      price: `${Number(plan.price).toFixed(Number(plan.price) % 1 === 0 ? 0 : 2)}€`,
      note: plan.description,
      badge: plan.badge,
      color: plan.themeColor,
      period: plan.period,
      features: plan.features || [],
    }));
  }, [pricingPlans]);

  const selectedPlan = plans.find((plan) => plan.value === selectedPackage) || plans[0];
  const selectedAmount = pendingPayment?.amount || getPlanPrice(selectedPlan);
  const selectedCurrency = pendingPayment?.currency || 'EUR';
  const referenceNumber = pendingPayment?.referenceNumber || `KAIZEN-${String(user?.id || 0).padStart(4, '0')}`;

  useEffect(() => {
    api.get('/client-dashboard')
      .then((data) => {
        setDashboardMeta({
          paymentApproved: Boolean(data.paymentApproved),
          unreadNotifications: data.unreadNotifications || 0,
        });
      })
      .catch(() => {});

    api.get('/pricing-plans?active=true')
      .then((rows) => {
        setPricingPlans(rows);
        setSelectedPackage(rows[0]?.slug || fallbackPackages[0].value);
      })
      .catch(() => {
        setSelectedPackage(fallbackPackages[0].value);
      });
  }, []);

  const startPayment = async () => {
    setError('');
    setMessage('');

    if (paymentMethod === 'stripe_card') {
      setError('Η πληρωμή με κάρτα μέσω Stripe θα ενεργοποιηθεί αργότερα. Προς το παρόν επίλεξε τραπεζικό έμβασμα.');
      return;
    }

    setSaving(true);
    try {
      const data = await api.post('/clients/me/billing', {
        subscriptionPackage: selectedPackage,
        paymentMethod,
      });
      setPendingPayment(data);
      setMessage('Η αίτηση πληρωμής καταχωρήθηκε. Κατάθεσε το ποσό και ο coach θα εγκρίνει τη συνδρομή σου manually.');
    } catch (err) {
      setError(err.message || 'Δεν αποθηκεύτηκε η πληρωμή.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      {sidebarOpen && <ClientSidebar user={user} paymentApproved={dashboardMeta.paymentApproved} unreadNotifications={dashboardMeta.unreadNotifications} active="billing" />}
      <ClientTopbar user={user} logout={logout} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((value) => !value)} title="Πληρωμές και Συνδρομή" />

      <main className={`${sidebarOpen ? 'ml-[300px]' : 'ml-0'} pt-[86px] transition-all duration-200`}>
        <div className="px-10 py-8">
          <div className="mb-7">
            <p className="text-sm font-bold text-slate-500">Dashboard / Πληρωμές και Συνδρομή</p>
            <h2 className="mt-2 text-3xl font-extrabold">{pendingPayment ? 'Ολοκλήρωση Πληρωμής' : 'Επιλέξτε το πακέτο σας'}</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
              {pendingPayment
                ? 'Για να ενεργοποιηθεί η συνδρομή σου, ολοκλήρωσε την κατάθεση. Ο coach θα εγκρίνει χειροκίνητα.'
                : 'Διάλεξε πρόγραμμα και τρόπο πληρωμής. Με τραπεζικό έμβασμα, ο coach εγκρίνει χειροκίνητα. Μέχρι την έγκριση, τα προγράμματα παραμένουν κλειδωμένα.'}
            </p>
          </div>

          {error && <Alert tone="red">{error}</Alert>}
          {message && <Alert tone="green">{message}</Alert>}

          {pendingPayment ? (
            <BankTransferPanel
              selectedPlan={selectedPlan}
              amount={selectedAmount}
              currency={selectedCurrency}
              referenceNumber={referenceNumber}
            />
          ) : (
            <>
              <section className="grid gap-5 lg:grid-cols-3">
                {plans.map((plan) => (
                  <PlanCard key={plan.value} plan={plan} active={selectedPackage === plan.value} onClick={() => setSelectedPackage(plan.value)} />
                ))}
              </section>

              <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_420px]">
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-black">Τρόπος Πληρωμής</h2>
                  <div className="mt-5 space-y-3">
                    <PaymentOption active={paymentMethod === 'bank_transfer'} title="Τραπεζικό έμβασμα" text="Θα δεις τα στοιχεία κατάθεσης. Ο coach θα εγκρίνει τη συνδρομή manually." onClick={() => setPaymentMethod('bank_transfer')} />
                    <PaymentOption active={paymentMethod === 'stripe_card'} title="Κάρτα μέσω Stripe" text="Προς το παρόν δεν είναι ενεργό." onClick={() => setPaymentMethod('stripe_card')} disabledNote />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-black">Σύνοψη</h2>
                  <div className="mt-5 rounded-xl border border-slate-200">
                    <SummaryRow label="Πακέτο" value={selectedPlan?.title || '-'} />
                    <SummaryRow label="Χρέωση" value={`${selectedPlan?.price || '-'} /${getPeriodLabel(selectedPlan?.period)}`} />
                    <SummaryRow label="Τρόπος" value={paymentMethod === 'bank_transfer' ? 'Τραπεζικό έμβασμα' : 'Κάρτα μέσω Stripe'} />
                  </div>
                  <button disabled={saving || !selectedPackage || paymentMethod === 'stripe_card'} onClick={startPayment} className="mt-6 h-12 w-full rounded-md bg-red-600 px-6 font-black text-white shadow-lg shadow-red-100 hover:bg-red-700 disabled:bg-slate-400">
                    {saving ? 'Αποθήκευση...' : paymentMethod === 'bank_transfer' ? 'Συνέχεια στα στοιχεία πληρωμής' : 'Stripe σύντομα'}
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function BankTransferPanel({ selectedPlan, amount, currency, referenceNumber }) {
  const formattedAmount = `${Number(amount || 0).toFixed(2)} ${currency === 'EUR' ? '€' : currency}`;

  const copyIban = async () => {
    try {
      await navigator.clipboard.writeText(bankDetails.iban);
    } catch {
      // Clipboard can be blocked in some browsers; the IBAN remains visible.
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-6 rounded-xl border border-slate-200 bg-white p-7 shadow-sm xl:grid-cols-[1fr_360px]">
        <div>
          <h2 className="text-xl font-black">Στοιχεία Τραπεζικού Λογαριασμού</h2>
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
            <BankRow label="Δικαιούχος" value={bankDetails.beneficiary} />
            <BankRow label="Τράπεζα" value={bankDetails.bank} />
            <BankRow label="IBAN" value={bankDetails.iban} action={<button onClick={copyIban} className="rounded-md border border-blue-100 px-3 py-1 text-xs font-black text-blue-700 hover:bg-blue-50">Copy</button>} />
            <BankRow label="Ποσό Κατάθεσης" value={formattedAmount} />
            <BankRow label="Αιτιολογία Κατάθεσης" value={referenceNumber} />
          </div>
        </div>

        <div className="self-center rounded-xl bg-emerald-50 p-6 text-emerald-950">
          <div className="mb-4 grid h-11 w-11 place-items-center rounded-full border border-emerald-300 text-lg font-black">i</div>
          <h3 className="font-black">Σημαντικό</h3>
          <p className="mt-3 text-sm font-semibold leading-7 text-emerald-900">
            Κατάθεσε ακριβώς το ποσό και χρησιμοποίησε την αιτιολογία <span className="font-black">{referenceNumber}</span>, ώστε να γίνει σωστά η ταυτοποίηση της πληρωμής.
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-amber-100 bg-amber-50 p-7 shadow-sm">
        <div className="flex items-start gap-5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-amber-200 text-2xl text-amber-800">⏳</div>
          <div>
            <h2 className="text-xl font-black text-amber-900">Αναμονή χειροκίνητης έγκρισης</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-amber-800">
              Η αίτησή σου καταχωρήθηκε. Μόλις πραγματοποιήσεις την κατάθεση, ο coach θα ελέγξει και θα εγκρίνει τη συνδρομή σου χειροκίνητα. Δεν χρειάζεται να ανεβάσεις αποδεικτικό.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-black">Τι συμβαίνει μετά;</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <NextStep title="Κάνεις την κατάθεση" text="Κατάθεσε το ποσό με την αιτιολογία που βλέπεις παραπάνω." />
          <NextStep title="Ο coach εγκρίνει χειροκίνητα" text="Μόλις επαληθευτεί η κατάθεση, ο coach ενεργοποιεί τη συνδρομή σου." />
          <NextStep title="Ενημερώνεσαι" text="Θα λάβεις ειδοποίηση όταν η συνδρομή σου γίνει ενεργή." />
        </div>
      </section>

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-800">
        Χρειάζεσαι βοήθεια; Επικοινώνησε μαζί μας στο {bankDetails.supportEmail} ή στο {bankDetails.supportPhone}.
      </div>
    </div>
  );
}

function PlanCard({ plan, active, onClick }) {
  const yearlyPrice = getPlanPrice(plan) ? getPlanPrice(plan) * 10 : null;
  return (
    <button type="button" onClick={onClick} className={`relative flex min-h-[410px] flex-col rounded-xl border bg-white p-7 text-left transition ${active ? 'border-red-500 shadow-xl shadow-red-100 ring-2 ring-red-50' : 'border-slate-200 hover:border-red-200 hover:shadow-lg hover:shadow-slate-100'}`}>
      {plan.badge && <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-b-md rounded-t-sm bg-red-600 px-5 py-2 text-xs font-black uppercase text-white">{plan.badge}</span>}
      <div className="grid h-14 w-14 place-items-center rounded-xl bg-slate-100 text-2xl" style={plan.color ? { color: plan.color, backgroundColor: `${plan.color}14` } : undefined}>{getPlanIcon(plan.title)}</div>
      <div className="mt-6 text-2xl font-black">{plan.title}</div>
      <p className="mt-2 min-h-12 text-sm font-semibold leading-6 text-slate-500">{plan.note}</p>
      <div className="mt-6 flex items-end gap-1">
        <span className="text-5xl font-black">{plan.price}</span>
        <span className="pb-2 text-sm font-bold text-slate-500">/{getPeriodLabel(plan.period)}</span>
      </div>
      {yearlyPrice && <div className="mt-2 text-sm font-black text-slate-700">ή €{yearlyPrice} /έτος <span className="text-emerald-600">(2 μήνες δωρεάν)</span></div>}
      <div className="mt-6 flex-1 space-y-3 text-sm font-bold text-slate-700">
        {(plan.features?.length ? plan.features : [
          { included: true, text: 'Προπονητικό πλάνο' },
          { included: true, text: 'Διατροφικό πλάνο' },
          { included: true, text: 'Progress tracking' },
          { included: true, text: 'Υποστήριξη μέσω μηνυμάτων' },
        ]).slice(0, 6).map((feature, index) => (
          <div key={index} className={`flex items-start gap-3 ${feature.included === false ? 'text-slate-400' : ''}`}>
            <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs ${feature.included === false ? 'bg-slate-100 text-slate-400' : 'bg-emerald-50 text-emerald-600'}`}>{feature.included === false ? '×' : '✓'}</span>
            <span>{feature.text}</span>
          </div>
        ))}
      </div>
      <div className={`mt-7 grid h-12 place-items-center rounded-md border text-sm font-black ${active ? 'border-red-600 bg-red-600 text-white' : 'border-slate-300 text-slate-800'}`}>
        {active ? 'Επιλεγμένο πακέτο' : 'Επιλογή'}
      </div>
    </button>
  );
}

function Alert({ children, tone }) {
  const className = tone === 'red' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700';
  return <div className={`mb-5 rounded-lg border px-5 py-4 text-sm font-bold ${className}`}>{children}</div>;
}

function PaymentOption({ active, title, text, onClick, disabledNote }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-4 rounded-lg border p-4 text-left ${active ? 'border-red-500 bg-red-50 ring-2 ring-red-100' : 'border-slate-200 bg-white hover:border-red-200'}`}>
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-black ${active ? 'border-red-600 bg-red-600 text-white' : 'border-slate-300 text-slate-400'}`}>{active ? '●' : ''}</span>
      <span>
        <span className="block font-black">{title}</span>
        <span className={`mt-1 block text-xs font-bold ${disabledNote ? 'text-amber-600' : 'text-slate-500'}`}>{text}</span>
      </span>
    </button>
  );
}

function BankRow({ label, value, action }) {
  return (
    <div className="grid grid-cols-[180px_1fr_auto] items-center gap-4 border-b border-slate-200 px-5 py-4 text-sm last:border-b-0">
      <span className="font-black text-slate-600">{label}</span>
      <span className="font-black text-slate-950">{value}</span>
      <span>{action}</span>
    </div>
  );
}

function NextStep({ title, text }) {
  return (
    <div className="rounded-xl bg-slate-50 p-5">
      <div className="mb-4 grid h-11 w-11 place-items-center rounded-full bg-emerald-100 text-emerald-700">✓</div>
      <div className="font-black">{title}</div>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{text}</p>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 text-sm last:border-b-0"><span className="font-bold text-slate-500">{label}</span><span className="font-black">{value}</span></div>;
}

function getPlanPrice(plan) {
  if (!plan?.price) return 0;
  const parsed = Number(String(plan.price).replace(/[^\d.,]/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPeriodLabel(period) {
  if (!period) return 'μήνα';
  const normalized = String(period).toLowerCase();
  if (normalized.includes('ετ') || normalized.includes('year')) return 'έτος';
  if (normalized.includes('μην') || normalized.includes('month')) return 'μήνα';
  return period;
}

function getPlanIcon(title = '') {
  const normalized = title.toLowerCase();
  if (normalized.includes('premium') || normalized.includes('pro')) return '◇';
  if (normalized.includes('elite')) return '♛';
  return 'ϟ';
}
