import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MenuToggle, TopbarActions } from '../components/TopbarControls';

const navSections = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Πελάτες', path: '/clients', active: true },
  { label: 'Βιβλιοθήκη Ασκήσεων', path: '/exercises' },
  { label: 'Media Library', path: '/media-library' },
  { label: 'Team', path: '/team' },
  { label: 'Analytics', path: '/analytics' },
  { label: 'Updates Πελατών', path: '/updates' },
  { label: 'Discord' },
  { label: 'Ειδοποιήσεις', path: '/notifications' },
  { label: 'Ρυθμίσεις' },
];

const client = {
  name: 'Νίκος Αντωνίου',
  email: 'nikos@example.com',
  phone: '+30 694 123 4567',
  discord: 'nikos_fit#4567',
  goal: 'Γράμμωση',
  currentWeight: '78.4 kg',
  targetWeight: '75 kg',
  subscription: 'Premium Coaching',
  status: 'Ενεργή',
  startDate: '01/04/2024',
  endDate: '01/07/2024',
  updateDays: ['Δευτέρα', 'Πέμπτη'],
  socials: [
    { label: 'Instagram', value: '@nikos_fit', url: 'https://instagram.com/nikos_fit' },
    { label: 'TikTok', value: '@nikos.training', url: 'https://tiktok.com/@nikos.training' },
  ],
};

const progressUpdates = [
  { date: '18/05/2024', weight: '78.4 kg', notes: 'Πολύ καλή εβδομάδα, υψηλή ενέργεια και καλή συνέπεια.' },
  { date: '11/05/2024', weight: '79.1 kg', notes: 'Μικρή κούραση στο τέλος της εβδομάδας, αλλά κράτησε τη διατροφή.' },
  { date: '04/05/2024', weight: '79.8 kg', notes: 'Ξεκίνησε δυνατά το νέο split και έστειλε πλήρες update.' },
];

const photos = [
  { id: 1, date: '18/05/2024', label: 'Front', tone: 'from-slate-700 to-slate-950' },
  { id: 2, date: '18/05/2024', label: 'Side', tone: 'from-zinc-600 to-zinc-950' },
  { id: 3, date: '18/05/2024', label: 'Back', tone: 'from-stone-600 to-stone-950' },
  { id: 4, date: '11/05/2024', label: 'Front', tone: 'from-slate-500 to-slate-800' },
];

const trainingPlans = [
  { title: 'Push / Pull / Legs - Phase 1', status: 'Τρέχον', duration: '8 εβδομάδες', days: '5 ημέρες/εβδομάδα' },
  { title: 'Upper / Lower Foundation', status: 'Ιστορικό', duration: '6 εβδομάδες', days: '4 ημέρες/εβδομάδα' },
  { title: 'Strength Base', status: 'Ιστορικό', duration: '4 εβδομάδες', days: '3 ημέρες/εβδομάδα' },
];

const nutritionPlans = [
  { title: '2200 kcal - High Protein', status: 'Τρέχον', macros: 'Πρωτεΐνη 160g, Υδατ. 220g, Λίπη 70g' },
  { title: '2400 kcal - Maintenance', status: 'Ιστορικό', macros: 'Πρωτεΐνη 150g, Υδατ. 270g, Λίπη 75g' },
  { title: '2100 kcal - Cut Start', status: 'Ιστορικό', macros: 'Πρωτεΐνη 155g, Υδατ. 200g, Λίπη 65g' },
];

const repsTracking = [
  { exercise: 'Bench Press', last: '80kg x 8', best: '85kg x 6', trend: '+2 reps' },
  { exercise: 'Squat', last: '110kg x 5', best: '115kg x 4', trend: '+5kg' },
  { exercise: 'Lat Pulldown', last: '70kg x 10', best: '70kg x 12', trend: '+2 reps' },
  { exercise: 'Romanian Deadlift', last: '95kg x 8', best: '100kg x 6', trend: 'stable' },
];

const tabs = [
  'Επισκόπηση',
  'Progress Updates',
  'Photos',
  'Training Plan',
  'Nutrition Plan',
  'Reps Tracking',
  'Social & Discord',
];

function Avatar({ initials, tone = 'bg-slate-900', size = 'h-12 w-12' }) {
  return <div className={`${size} ${tone} grid place-items-center rounded-full text-xs font-bold text-white shadow-sm`}>{initials}</div>;
}

function Card({ children, className = '', id }) {
  return <section id={id} className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

function Sidebar({ user }) {
  return (
    <aside className="fixed inset-y-0 left-0 flex w-[300px] flex-col bg-[#07131d] text-white shadow-2xl">
      <div className="flex h-[86px] items-center gap-3 px-8">
        <div className="grid h-12 w-12 place-items-center rounded-full border-4 border-red-600 text-2xl font-black text-red-500">K</div>
        <div className="text-xl font-extrabold tracking-wide">COACH PANEL</div>
      </div>
      <nav className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="space-y-1">
          {navSections.map((section) => {
            const className = `flex h-12 w-full items-center rounded-md px-4 text-left text-[15px] font-semibold ${
              section.active ? 'bg-red-600 text-white shadow-lg shadow-red-950/30' : 'text-slate-100 hover:bg-white/10'
            }`;
            return section.path ? (
              <Link key={section.label} to={section.path} className={className}>{section.label}</Link>
            ) : (
              <button key={section.label} className={className}>{section.label}</button>
            );
          })}
        </div>
      </nav>
      <div className="border-t border-white/10 p-7">
        <div className="flex items-center gap-3">
          <Avatar initials={(user?.fullName || 'Coach Admin').slice(0, 2).toUpperCase()} tone="bg-red-600" />
          <div>
            <div className="font-bold">{user?.fullName || 'Coach Admin'}</div>
            <div className="mt-1 flex items-center gap-2 text-sm text-emerald-400"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />Online</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ user, logout, sidebarOpen, onToggleSidebar }) {
  return (
    <header className={`fixed ${sidebarOpen ? 'left-[300px]' : 'left-0'} right-0 top-0 z-10 flex h-[86px] items-center justify-between border-b border-slate-200 bg-white px-10 shadow-sm transition-all duration-200`}>
      <div className="flex items-center gap-9">
        <MenuToggle onClick={onToggleSidebar} />
        <h1 className="text-2xl font-extrabold">Πελάτες</h1>
      </div>
      <TopbarActions user={user} logout={logout} Avatar={Avatar} />
    </header>
  );
}

export default function ClientDetail() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [activeTab, setActiveTab] = useState('Επισκόπηση');
  const [selectedPhoto, setSelectedPhoto] = useState(photos[0]);
  const [coachNote, setCoachNote] = useState('Πολύ καλή συνέπεια στις προπονήσεις και στη διατροφή. Να προσέξει λίγο περισσότερο τον ύπνο και την ενυδάτωση.');
  const [messageDraft, setMessageDraft] = useState('');

  React.useEffect(() => {
    const action = new URLSearchParams(location.search).get('action');
    if (action === 'message') setActiveTab('Social & Discord');
    if (action === 'subscription' || action === 'notes' || action === 'edit') setActiveTab('Επισκόπηση');
    if (action === 'update') setActiveTab('Progress Updates');

    window.setTimeout(() => {
      if (!location.hash) return;
      const target = document.querySelector(location.hash);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  }, [location.hash, location.search]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      {sidebarOpen && <Sidebar user={user} />}
      <Topbar user={user} logout={logout} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((value) => !value)} />

      <main className={`${sidebarOpen ? 'ml-[300px]' : 'ml-0'} pt-[86px] transition-all duration-200`}>
        <div className="px-10 py-6">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm">
              <Link to="/dashboard" className="font-semibold text-blue-600">Dashboard</Link>
              <span className="text-slate-400">›</span>
              <Link to="/clients" className="font-semibold text-blue-600">Πελάτες</Link>
              <span className="text-slate-400">›</span>
              <span className="text-slate-600">{client.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <button className="h-10 rounded-md border border-slate-200 bg-white px-5 font-semibold hover:border-slate-300">Επεξεργασία</button>
              <button className="h-10 rounded-md bg-red-600 px-5 font-bold text-white shadow-lg shadow-red-200 hover:bg-red-700">Αποστολή Μηνύματος</button>
            </div>
          </div>

          <ProfileHeader />

          <Card className="mt-5 px-5">
            <div className="flex h-14 items-center gap-6 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`h-full shrink-0 border-b-2 px-2 text-sm font-bold ${
                    activeTab === tab ? 'border-red-600 text-red-600' : 'border-transparent text-slate-600 hover:text-red-600'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </Card>

          <div className="mt-5">
            {activeTab === 'Επισκόπηση' && <Overview coachNote={coachNote} setCoachNote={setCoachNote} setActiveTab={setActiveTab} />}
            {activeTab === 'Progress Updates' && <ProgressUpdates />}
            {activeTab === 'Photos' && <PhotosViewer selectedPhoto={selectedPhoto} setSelectedPhoto={setSelectedPhoto} />}
            {activeTab === 'Training Plan' && <Plans type="training" />}
            {activeTab === 'Nutrition Plan' && <Plans type="nutrition" />}
            {activeTab === 'Reps Tracking' && <RepsTracking />}
            {activeTab === 'Social & Discord' && <SocialDiscord messageDraft={messageDraft} setMessageDraft={setMessageDraft} />}
          </div>
        </div>
      </main>
    </div>
  );
}

function ProfileHeader() {
  return (
    <Card className="p-5">
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-2">
          <div className="relative h-[250px] overflow-hidden rounded-lg bg-gradient-to-b from-slate-200 to-slate-400">
            <span className="absolute left-3 top-3 rounded-md bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">Ενεργός</span>
            <div className="absolute inset-x-0 bottom-0 flex h-14 items-center justify-center bg-black/70 text-sm font-bold text-white">Φωτογραφία Πελάτη</div>
            <div className="grid h-full place-items-center pt-8">
              <Avatar initials="ΝΑ" tone="bg-slate-900" size="h-28 w-28" />
            </div>
          </div>
        </div>

        <div className="col-span-10 grid grid-cols-4 divide-x divide-slate-200">
          <InfoGroup title={client.name} items={[client.email, client.phone, `Discord: ${client.discord}`, `Update days: ${client.updateDays.join(', ')}`]} />
          <InfoGroup title="Στόχος" items={[client.goal, `Τρέχον: ${client.currentWeight}`, `Στόχος βάρους: ${client.targetWeight}`, 'Πρόοδος: -2.4 kg']} highlightLast />
          <InfoGroup id="client-subscription-section" title="Συνδρομή & Status" items={[client.subscription, `Έναρξη: ${client.startDate}`, `Λήξη: ${client.endDate}`, `Κατάσταση: ${client.status}`]} />
          <div className="px-8">
            <h3 className="font-extrabold">Social Media</h3>
            <div className="mt-5 space-y-3">
              {client.socials.map((social) => (
                <a key={social.label} href={social.url} target="_blank" rel="noreferrer" className="block rounded-md border border-slate-200 px-4 py-3 text-sm font-bold hover:border-red-200 hover:text-red-600">
                  {social.label}: {social.value}
                </a>
              ))}
              <button className="w-full rounded-md border border-indigo-200 px-4 py-3 text-left text-sm font-bold text-indigo-700 hover:bg-indigo-50">
                Discord: {client.discord}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Overview({ coachNote, setCoachNote, setActiveTab }) {
  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-4 space-y-5">
        <WeightChart />
        <Card id="client-notes-section" className="p-5 scroll-mt-28">
          <h3 className="font-extrabold">Σημειώσεις Coach</h3>
          <textarea value={coachNote} onChange={(e) => setCoachNote(e.target.value)} className="mt-4 min-h-32 w-full rounded-lg border border-slate-200 bg-amber-50 p-4 text-sm leading-7 outline-none focus:border-red-300" />
        </Card>
      </div>
      <div className="col-span-4 space-y-5">
        <PlanPreview setActiveTab={setActiveTab} />
        <RecentUpdates setActiveTab={setActiveTab} />
      </div>
      <div className="col-span-4 space-y-5">
        <SummaryCard />
        <QuickActions setActiveTab={setActiveTab} />
      </div>
    </div>
  );
}

function ProgressUpdates() {
  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-7"><WeightChart /></div>
      <Card className="col-span-5 p-5">
        <h3 className="font-extrabold">Progress Updates</h3>
        <div className="mt-5 space-y-4">
          {progressUpdates.map((update) => (
            <div key={update.date} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="font-extrabold">{update.date}</span>
                <span className="font-extrabold text-blue-600">{update.weight}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{update.notes}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function PhotosViewer({ selectedPhoto, setSelectedPhoto }) {
  return (
    <div className="grid grid-cols-12 gap-5">
      <Card className="col-span-8 p-5">
        <div className={`grid h-[520px] place-items-center rounded-lg bg-gradient-to-br ${selectedPhoto.tone} text-center text-white`}>
          <div>
            <div className="text-5xl font-black">{selectedPhoto.label}</div>
            <div className="mt-4 text-lg font-bold">{selectedPhoto.date}</div>
          </div>
        </div>
      </Card>
      <Card className="col-span-4 p-5">
        <h3 className="font-extrabold">Photos Viewer</h3>
        <div className="mt-5 grid grid-cols-2 gap-4">
          {photos.map((photo) => (
            <button key={photo.id} onClick={() => setSelectedPhoto(photo)} className={`h-32 rounded-lg bg-gradient-to-br ${photo.tone} p-3 text-left text-sm font-bold text-white ring-2 ${selectedPhoto.id === photo.id ? 'ring-red-500' : 'ring-transparent'}`}>
              {photo.label}<br />{photo.date}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Plans({ type }) {
  const plans = type === 'training' ? trainingPlans : nutritionPlans;
  return (
    <Card className="p-5">
      <h3 className="text-lg font-extrabold">{type === 'training' ? 'Training Plan - Τρέχον + Ιστορικό' : 'Nutrition Plan - Τρέχον + Ιστορικό'}</h3>
      <div className="mt-5 grid grid-cols-3 gap-5">
        {plans.map((plan) => (
          <div key={plan.title} className="rounded-lg border border-slate-200 p-5">
            <span className={`rounded-md px-3 py-1 text-xs font-bold ${plan.status === 'Τρέχον' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{plan.status}</span>
            <h4 className="mt-5 text-lg font-extrabold">{plan.title}</h4>
            <p className="mt-3 text-sm leading-6 text-slate-600">{type === 'training' ? `${plan.duration}, ${plan.days}` : plan.macros}</p>
            <button className="mt-5 rounded-md border border-slate-200 px-4 py-2 text-sm font-bold hover:border-red-200 hover:text-red-600">Προβολή</button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RepsTracking() {
  return (
    <Card className="overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="h-14 border-b border-slate-200 text-left text-sm font-extrabold">
            <th className="px-6">Άσκηση</th>
            <th className="px-6">Τελευταία Καταχώρηση</th>
            <th className="px-6">Personal Best</th>
            <th className="px-6">Τάση</th>
          </tr>
        </thead>
        <tbody>
          {repsTracking.map((row) => (
            <tr key={row.exercise} className="h-16 border-b border-slate-100 last:border-b-0">
              <td className="px-6 font-bold">{row.exercise}</td>
              <td className="px-6">{row.last}</td>
              <td className="px-6">{row.best}</td>
              <td className="px-6 font-bold text-emerald-600">{row.trend}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function SocialDiscord({ messageDraft, setMessageDraft }) {
  return (
    <div className="grid grid-cols-3 gap-5">
      <Card id="client-message-section" className="p-5 scroll-mt-28">
        <h3 className="font-extrabold">Αποστολή Μηνύματος</h3>
        <textarea
          value={messageDraft}
          onChange={(event) => setMessageDraft(event.target.value)}
          placeholder="Γράψε μήνυμα προς τον πελάτη..."
          className="mt-5 min-h-36 w-full rounded-lg border border-slate-200 p-4 text-sm leading-6 outline-none focus:border-red-300"
        />
        <button className="mt-4 h-11 rounded-md bg-red-600 px-5 text-sm font-bold text-white hover:bg-red-700">
          Αποστολή
        </button>
      </Card>
      <Card className="p-5">
        <h3 className="font-extrabold">Social Links</h3>
        <div className="mt-5 space-y-3">
          {client.socials.map((social) => (
            <a key={social.label} href={social.url} target="_blank" rel="noreferrer" className="block rounded-md border border-slate-200 px-5 py-4 font-bold hover:border-red-200 hover:text-red-600">
              {social.label}: {social.value}
            </a>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <h3 className="font-extrabold">Discord Link</h3>
        <div className="mt-5 rounded-lg border border-indigo-200 bg-indigo-50 p-5">
          <div className="text-sm text-indigo-700">Discord ID</div>
          <div className="mt-2 text-2xl font-extrabold text-indigo-950">{client.discord}</div>
          <button className="mt-5 rounded-md bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700">Άνοιγμα Discord</button>
        </div>
      </Card>
    </div>
  );
}

function WeightChart() {
  const points = '5,18 16,19 27,22 38,32 49,31 60,39 70,46 80,54 90,49 97,58';
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-extrabold">Πρόοδος Βάρους</h3>
        <button className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600">Τελευταίες 30 ημέρες⌄</button>
      </div>
      <div className="relative h-[230px]">
        {[0, 1, 2, 3].map((line) => <div key={line} className="absolute inset-x-0 h-px bg-slate-100" style={{ top: `${line * 25 + 10}%` }} />)}
        <svg viewBox="0 0 100 70" preserveAspectRatio="none" className="absolute left-4 top-2 h-[185px] w-[calc(100%-2rem)] overflow-visible">
          <polyline points={points} fill="none" stroke="#2563eb" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
          {points.split(' ').map((point) => {
            const [x, y] = point.split(',');
            return <circle key={point} cx={x} cy={y} r="1.5" fill="#2563eb" vectorEffect="non-scaling-stroke" />;
          })}
        </svg>
        <div className="absolute bottom-0 left-4 right-4 flex justify-between text-xs text-slate-500">
          <span>18/04</span><span>23/04</span><span>28/04</span><span>03/05</span><span>08/05</span><span>13/05</span><span>18/05</span>
        </div>
      </div>
    </Card>
  );
}

function InfoGroup({ id, title, items, highlightLast = false }) {
  return (
    <div id={id} className="scroll-mt-28 px-8">
      <h2 className="text-xl font-extrabold">{title}</h2>
      <div className="mt-5 space-y-4 text-sm">
        {items.map((item, index) => <p key={item} className={highlightLast && index === items.length - 1 ? 'font-bold text-emerald-600' : 'font-semibold text-slate-700'}>{item}</p>)}
      </div>
    </div>
  );
}

function PlanPreview({ setActiveTab }) {
  return (
    <Card className="p-5">
      <h3 className="font-extrabold">Τρέχοντα Προγράμματα</h3>
      <div className="mt-4 space-y-4">
        <PreviewRow title="Push / Pull / Legs - Phase 1" meta="8 εβδομάδες, 5 ημέρες/εβδομάδα" onClick={() => setActiveTab('Training Plan')} />
        <PreviewRow title="2200 kcal - High Protein" meta="160g πρωτεΐνη, 220g υδατάνθρακες" onClick={() => setActiveTab('Nutrition Plan')} />
      </div>
    </Card>
  );
}

function PreviewRow({ title, meta, onClick }) {
  return (
    <button onClick={onClick} className="w-full rounded-lg border border-slate-200 p-4 text-left hover:border-red-200 hover:text-red-600">
      <div className="font-extrabold">{title}</div>
      <div className="mt-2 text-sm text-slate-600">{meta}</div>
    </button>
  );
}

function RecentUpdates({ setActiveTab }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-extrabold">Τελευταία Updates</h3>
        <button onClick={() => setActiveTab('Progress Updates')} className="text-sm font-bold text-blue-600">Προβολή όλων</button>
      </div>
      <div className="mt-4 space-y-4">
        {progressUpdates.map((update) => <div key={update.date} className="flex items-center justify-between text-sm"><span>{update.date}</span><span className="font-bold">{update.weight}</span></div>)}
      </div>
    </Card>
  );
}

function SummaryCard() {
  return (
    <Card className="p-5">
      <h3 className="font-extrabold">Σύνοψη</h3>
      <div className="mt-6 space-y-5 text-sm">
        <Summary label="Συνολικά Kg που χάθηκαν" value="-2.4 kg" positive />
        <Summary label="Συνολικά Updates" value="7" />
        <Summary label="Συνολικές Προπονήσεις" value="24" />
        <Summary label="Συνολικές Φωτογραφίες" value="21" />
        <Summary label="Συνολικοί Πόντοι" value="1.250 pts" />
      </div>
    </Card>
  );
}

function QuickActions({ setActiveTab }) {
  return (
    <Card className="p-5">
      <h3 className="font-extrabold">Γρήγορες Ενέργειες</h3>
      <div className="mt-5 space-y-3">
        <button onClick={() => setActiveTab('Progress Updates')} className="h-11 w-full rounded-md border border-slate-200 px-5 text-left text-sm font-semibold hover:border-red-200 hover:text-red-600">Προσθήκη Update</button>
        <button onClick={() => setActiveTab('Reps Tracking')} className="h-11 w-full rounded-md border border-slate-200 px-5 text-left text-sm font-semibold hover:border-red-200 hover:text-red-600">Καταχώρηση Reps</button>
        <button onClick={() => setActiveTab('Social & Discord')} className="h-11 w-full rounded-md border border-slate-200 px-5 text-left text-sm font-semibold hover:border-red-200 hover:text-red-600">Social / Discord Links</button>
      </div>
    </Card>
  );
}

function Summary({ label, value, positive = false }) {
  return <div className="flex items-center justify-between"><span className="text-slate-600">{label}</span><span className={`font-extrabold ${positive ? 'text-emerald-600' : ''}`}>{value}</span></div>;
}

