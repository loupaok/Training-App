import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MenuToggle, TopbarActions } from '../components/TopbarControls';
import { api } from '../services/api';
import { compressImageFile } from '../services/imageCompression';
import PaginationControls from '../components/PaginationControls';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

const navSections = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Πελάτες', path: '/clients' },
  { label: 'Updates Πελατών', path: '/updates' },
  { label: 'Βιβλιοθήκη Ασκήσεων', path: '/exercises', active: true },
  { label: 'Analytics', path: '/analytics' },
  { label: 'Media Library', path: '/media-library' },
  { label: 'Team', path: '/team' },
  { label: 'Ειδοποιήσεις', path: '/notifications', spacerBefore: true },
  {
    label: 'Ρυθμίσεις',
    adminOnly: true,
    children: [
      { label: 'Discord' },
      { label: 'Πλάνα & Τιμές', path: '/pricing-plans' },
      { label: 'Branding' },
    ],
  },
];

const fallbackExercises = [
  {
    id: 'fallback-1',
    name: 'Bench Press',
    muscleGroup: 'Στήθος',
    equipment: 'Μπάρα, Πάγκος',
    level: 'Μεσαίο',
    type: 'Δύναμη',
    programsCount: 24,
    instructions: 'Πίεσε τη μπάρα από το στήθος προς τα πάνω κρατώντας τις ωμοπλάτες σταθερές και τα πόδια πατημένα.',
  },
  {
    id: 'fallback-2',
    name: 'Back Squat',
    muscleGroup: 'Τετρακέφαλοι',
    equipment: 'Μπάρα',
    level: 'Δύσκολο',
    type: 'Δύναμη',
    programsCount: 31,
    instructions: 'Κράτα κορμό σταθερό, λύγισε γόνατα και ισχία, και ανέβα πιέζοντας όλο το πέλμα στο έδαφος.',
  },
];

const icons = {
  menu: 'M4 6h16M4 12h16M4 18h16',
  search: 'M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z',
  bell: 'M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m2 0a2 2 0 0 0 4 0',
  mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
  plus: 'M12 5v14M5 12h14',
  filter: 'M4 5h16l-6 7v5l-4 2v-7L4 5Z',
  dumbbell: 'M5 9v6M8 7v10M16 7v10M19 9v6M8 12h8',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  box: 'M21 8l-9-5-9 5 9 5 9-5ZM3 8v8l9 5 9-5V8M12 13v8',
  chart: 'M4 19V5M8 17v-6M13 17V8M18 17v-9M4 19h17',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  edit: 'M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3ZM14 8l2 2',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5',
  close: 'M6 6l12 12M18 6 6 18',
  upload: 'M12 16V4M7 9l5-5 5 5M5 20h14',
  play: 'M8 5v14l11-7L8 5Z',
  image: 'M4 5h16v14H4zM7 15l3-3 2 2 3-4 3 5M8 9h.01',
};

function Icon({ name, className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={icons[name]} />
    </svg>
  );
}

function Avatar({ initials, tone = 'bg-slate-900', size = 'h-12 w-12' }) {
  return <div className={`${size} ${tone} grid place-items-center rounded-full text-xs font-bold text-white shadow-sm`}>{initials}</div>;
}

function Card({ children, className = '' }) {
  return <section className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

function Sidebar({ user }) {
  const settingsIsActive = navSections.some((section) => section.children?.some((child) => child.active));
  const [settingsOpen, setSettingsOpen] = React.useState(settingsIsActive);

  return (
    <aside className="fixed inset-y-0 left-0 flex w-[300px] flex-col bg-[#07131d] text-white shadow-2xl">
      <div className="flex h-[86px] items-center gap-3 px-8">
        <div className="grid h-12 w-12 place-items-center rounded-full border-4 border-red-600 text-2xl font-black text-red-500">K</div>
        <div className="text-xl font-extrabold tracking-wide">COACH PANEL</div>
      </div>
      <nav className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="space-y-1">
          {navSections.filter((section) => !section.adminOnly || user?.role === 'admin').map((section) => {
            const className = `flex h-12 w-full items-center rounded-md px-4 text-left text-[15px] font-semibold ${section.active ? 'bg-red-600 text-white shadow-lg shadow-red-950/30' : 'text-slate-100 hover:bg-white/10'}`;
            const item = section.children ? (
              <button onClick={() => setSettingsOpen((value) => !value)} className={className}>
                <span>{section.label}</span>
                <span className={`ml-auto text-xs transition-transform ${settingsOpen ? 'rotate-180' : ''}`}>⌄</span>
              </button>
            ) : section.path ? <Link to={section.path} className={className}>{section.label}</Link> : <button className={className}>{section.label}</button>;
            return (
              <div key={section.label} className={section.spacerBefore ? 'mt-6' : ''}>
                {item}
                {section.children && user?.role === 'admin' && (
                  <div className={`ml-4 overflow-hidden border-l border-white/10 pl-3 transition-all duration-200 ${settingsOpen ? 'mt-1 max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                    {section.children.map((child) => (
                      child.path ? (
                        <Link key={child.label} to={child.path} className="flex h-10 w-full items-center rounded-md px-4 text-left text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white">{child.label}</Link>
                      ) : (
                        <button key={child.label} className="flex h-10 w-full items-center rounded-md px-4 text-left text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white">{child.label}</button>
                      )
                    ))}
                  </div>
                )}
              </div>
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
        <h1 className="text-2xl font-extrabold">Βιβλιοθήκη Ασκήσεων</h1>
      </div>
      <TopbarActions user={user} logout={logout} Avatar={Avatar} />
    </header>
  );
}

export default function Exercises() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [exercises, setExercises] = useState([]);
  const [filters, setFilters] = useState({ muscleGroups: [], equipment: [], levels: [], types: [] });
  const [search, setSearch] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [equipment, setEquipment] = useState('');
  const [level, setLevel] = useState('');
  const [selected, setSelected] = useState(null);
  const [modalMode, setModalMode] = useState('view');
  const [isCreating, setIsCreating] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [editForm, setEditForm] = useState(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaAssets, setMediaAssets] = useState([]);
  const [mediaSearch, setMediaSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [mediaMessage, setMediaMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    api.get('/exercises/filters')
      .then((data) => setFilters({
        muscleGroups: data.muscleGroups.map((item) => item.value),
        equipment: data.equipment.map((item) => item.value),
        levels: data.levels.map((item) => item.value),
        types: data.types?.map((item) => item.value) || [],
      }))
      .catch(() => setFilters({
        muscleGroups: uniqueOptions(fallbackExercises, 'muscleGroup'),
        equipment: uniqueOptions(fallbackExercises, 'equipment'),
        levels: uniqueOptions(fallbackExercises, 'level'),
        types: uniqueOptions(fallbackExercises, 'type'),
      }));
  }, []);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setCurrentPage(1);

    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (muscleGroup) params.set('muscleGroup', muscleGroup);
    if (equipment) params.set('equipment', equipment);
    if (level) params.set('level', level);

    api.get(`/exercises?${params.toString()}`)
      .then((data) => { if (!ignore) setExercises(data); })
      .catch(() => {
        if (!ignore) setExercises(filterLocal(fallbackExercises, { search, muscleGroup, equipment, level }));
      })
      .finally(() => { if (!ignore) setLoading(false); });

    return () => { ignore = true; };
  }, [search, muscleGroup, equipment, level]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(exercises.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, exercises.length, pageSize]);

  const stats = useMemo(() => ({
    total: exercises.length,
    muscleGroups: filters.muscleGroups.length,
    equipment: filters.equipment.length,
    inPrograms: exercises.reduce((sum, exercise) => sum + Number(exercise.programsCount || 0), 0),
  }), [exercises, filters]);
  const muscleGroupOptions = useMemo(() => withDefaults(filters.muscleGroups, ['Στήθος', 'Πλάτη', 'Ώμοι', 'Δικέφαλοι', 'Τρικέφαλοι', 'Τετρακέφαλοι', 'Οπίσθιοι Μηριαίοι', 'Γλουτοί', 'Γάμπες', 'Κοιλιακοί', 'Core', 'Full Body', 'Γενική']), [filters.muscleGroups]);
  const equipmentOptions = useMemo(() => withDefaults(filters.equipment, ['Χωρίς εξοπλισμό', 'Σωματικό βάρος', 'Μπάρα', 'Αλτήρες', 'Μηχάνημα', 'Τροχαλία', 'Πάγκος', 'Kettlebell', 'Λάστιχα', 'TRX']), [filters.equipment]);
  const typeOptions = useMemo(() => withDefaults(filters.types, ['Δύναμη', 'Υπερτροφία', 'Αντοχή', 'Κινητικότητα', 'Cardio', 'Core', 'Αποκατάσταση']), [filters.types]);

  const paginatedExercises = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return exercises.slice(start, start + pageSize);
  }, [currentPage, exercises, pageSize]);

  const changePageSize = (size) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const openExercise = (exercise, mode = 'view') => {
    setIsCreating(false);
    setModalMode(mode);
    setSelected(exercise);
    setImageUrl(exercise.imageUrl || '');
    setVideoUrl(exercise.videoUrl || '');
    setEditForm({
      name: exercise.name || '',
      muscleGroup: exercise.muscleGroup || '',
      equipment: exercise.equipment || '',
      level: exercise.level || 'Μεσαίο',
      type: exercise.type || 'Δύναμη',
      instructions: exercise.instructions || '',
      programsCount: exercise.programsCount || 0,
      imageUrl: exercise.imageUrl || '',
      videoUrl: exercise.videoUrl || '',
    });
    setMediaMessage('');
  };

  const openCreateExercise = () => {
    const draft = {
      id: 'new',
      name: '',
      muscleGroup: '',
      equipment: '',
      level: 'Μεσαίο',
      type: 'Δύναμη',
      programsCount: 0,
      instructions: '',
      imageUrl: '',
      videoUrl: '',
    };
    setIsCreating(true);
    setModalMode('edit');
    setSelected(draft);
    setImageUrl('');
    setVideoUrl('');
    setEditForm(draft);
    setMediaMessage('');
  };

  const updateSelected = (patch) => {
    setSelected((current) => current ? { ...current, ...patch } : current);
    setExercises((items) => items.map((item) => item.id === selected?.id ? { ...item, ...patch } : item));
  };

  const saveMedia = async () => {
    if (!selected || String(selected.id).startsWith('fallback')) return;
    setSaving(true);
    setMediaMessage('');
    try {
      const response = await api.put(`/exercises/${selected.id}/media`, { imageUrl, videoUrl });
      updateSelected({ imageUrl: response.imageUrl, videoUrl: response.videoUrl });
      setMediaMessage('Αποθηκεύτηκαν οι αλλαγές media στη βάση.');
    } catch (error) {
      setMediaMessage(error.message || 'Δεν αποθηκεύτηκαν οι αλλαγές.');
    } finally {
      setSaving(false);
    }
  };

  const updateEditField = (field, value) => {
    setEditForm((current) => ({ ...current, [field]: value }));
    if (field === 'imageUrl') setImageUrl(value);
    if (field === 'videoUrl') setVideoUrl(value);
  };

  const saveExercise = async () => {
    if (!selected || !editForm || String(selected.id).startsWith('fallback')) return;
    setSaving(true);
    setMediaMessage('');

    try {
      const payload = {
        ...editForm,
        name: editForm.name?.trim() || 'Νέα Άσκηση',
        muscleGroup: editForm.muscleGroup?.trim() || 'Γενική',
        equipment: editForm.equipment?.trim() || 'Χωρίς εξοπλισμό',
        level: editForm.level || 'Μεσαίο',
        type: editForm.type?.trim() || 'Δύναμη',
        programsCount: Number(editForm.programsCount || 0),
      };

      const updated = isCreating
        ? await api.post('/exercises', payload)
        : await api.put(`/exercises/${selected.id}`, payload);

      setSelected(updated);
      setIsCreating(false);
      setImageUrl(updated.imageUrl || '');
      setVideoUrl(updated.videoUrl || '');
      setEditForm({
        name: updated.name || '',
        muscleGroup: updated.muscleGroup || '',
        equipment: updated.equipment || '',
        level: updated.level || 'Μεσαίο',
        type: updated.type || 'Δύναμη',
        instructions: updated.instructions || '',
        programsCount: updated.programsCount || 0,
        imageUrl: updated.imageUrl || '',
        videoUrl: updated.videoUrl || '',
      });
      setExercises((items) => isCreating ? [updated, ...items] : items.map((item) => item.id === updated.id ? updated : item));
      setMediaMessage(isCreating ? 'Η άσκηση προστέθηκε στη βάση.' : 'Η άσκηση ενημερώθηκε στη βάση.');
    } catch (error) {
      setMediaMessage(error.message || 'Δεν αποθηκεύτηκαν οι αλλαγές της άσκησης.');
    } finally {
      setSaving(false);
    }
  };

  const deleteExercise = async (exercise = selected) => {
    if (!exercise || isCreating || String(exercise.id).startsWith('fallback')) return;
    const confirmed = window.confirm(`Να διαγραφεί η άσκηση "${exercise.name}";`);
    if (!confirmed) return;

    setSaving(true);
    setMediaMessage('');
    try {
      await api.delete(`/exercises/${exercise.id}`);
      setExercises((items) => items.filter((item) => item.id !== exercise.id));
      if (selected?.id === exercise.id) {
        setSelected(null);
        setEditForm(null);
      }
    } catch (error) {
      setMediaMessage(error.message || 'Δεν έγινε διαγραφή της άσκησης.');
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !selected || String(selected.id).startsWith('fallback')) return;

    setSaving(true);
    setMediaMessage('Συμπίεση φωτογραφίας...');

    const compressedFile = await compressImageFile(file);
    const formData = new FormData();
    formData.append('image', compressedFile);

    try {
      const response = await api.upload(`/exercises/${selected.id}/image`, formData);
      setImageUrl(response.imageUrl);
      setEditForm((current) => ({ ...current, imageUrl: response.imageUrl }));
      updateSelected({ imageUrl: response.imageUrl });
      setMediaMessage(`Η φωτογραφία συμπιέστηκε και αποθηκεύτηκε στην άσκηση. ${formatBytes(file.size)} → ${formatBytes(compressedFile.size)}`);
    } catch (error) {
      setMediaMessage(error.message || 'Το upload απέτυχε.');
    } finally {
      setSaving(false);
      event.target.value = '';
    }
  };

  const openMediaPicker = async () => {
    setMediaPickerOpen(true);
    setMediaSearch('');
    try {
      const assets = await api.get('/media');
      setMediaAssets(assets.filter((asset) => asset.assetType === 'photo'));
    } catch {
      setMediaAssets([]);
    }
  };

  const chooseMediaAsset = (asset) => {
    updateEditField('imageUrl', asset.url);
    setMediaMessage(`Επιλέχθηκε εικόνα από Media Library: ${asset.title}`);
    setMediaPickerOpen(false);
  };

  const clearThumbnail = () => {
    updateEditField('imageUrl', '');
    setMediaMessage('Το thumbnail αφαιρέθηκε. Πάτησε αποθήκευση για να ενημερωθεί η άσκηση.');
  };

  const filteredMediaAssets = mediaAssets.filter((asset) => {
    return !mediaSearch || asset.title.toLowerCase().includes(mediaSearch.toLowerCase()) || asset.folderName?.toLowerCase().includes(mediaSearch.toLowerCase());
  });
  const isReadOnly = modalMode === 'view';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      {sidebarOpen && <Sidebar user={user} />}
      <Topbar user={user} logout={logout} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((value) => !value)} />
      <main className={`${sidebarOpen ? 'ml-[300px]' : 'ml-0'} pt-[86px] transition-all duration-200`}>
        <div className="px-10 py-7">
          <div className="mb-7 flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm">
              <Link to="/dashboard" className="font-semibold text-blue-600">Dashboard</Link>
              <span className="text-slate-400">›</span>
              <span className="text-slate-600">Βιβλιοθήκη Ασκήσεων</span>
            </div>
            <button onClick={openCreateExercise} className="flex h-12 items-center gap-3 rounded-md bg-red-600 px-6 font-bold text-white shadow-lg shadow-red-200 hover:bg-red-700">
              <Icon name="plus" />
              Προσθήκη Άσκησης
            </button>
          </div>

          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-4 flex h-14 items-center rounded-lg border border-slate-200 bg-white px-5 shadow-sm">
              <Icon name="search" className="mr-3 h-5 w-5 text-slate-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Αναζήτηση άσκησης..." className="w-full bg-transparent outline-none placeholder:text-slate-500" />
            </div>
            <SelectFilter label="Μυϊκή Ομάδα" value={muscleGroup} onChange={setMuscleGroup} options={filters.muscleGroups} className="col-span-3" />
            <SelectFilter label="Εξοπλισμός" value={equipment} onChange={setEquipment} options={filters.equipment} className="col-span-2" />
            <SelectFilter label="Επίπεδο" value={level} onChange={setLevel} options={filters.levels} className="col-span-2" />
            <button onClick={() => { setSearch(''); setMuscleGroup(''); setEquipment(''); setLevel(''); }} className="col-span-1 flex h-14 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 shadow-sm hover:border-red-200 hover:text-red-600">
              <Icon name="filter" />
              Reset
            </button>
          </div>

          <div className="mt-5 grid grid-cols-4 gap-5">
            <StatCard label="Σύνολο Ασκήσεων" value={stats.total} note="με ενεργά φίλτρα" tone="bg-blue-50 text-blue-600" icon="dumbbell" />
            <StatCard label="Μυϊκές Ομάδες" value={stats.muscleGroups} note="διαθέσιμες" tone="bg-emerald-50 text-emerald-600" icon="target" />
            <StatCard label="Εξοπλισμοί" value={stats.equipment} note="διαθέσιμοι" tone="bg-violet-50 text-violet-600" icon="box" />
            <StatCard label="Ασκήσεις σε Προγράμματα" value={stats.inPrograms} note="χρήσεις συνολικά" tone="bg-orange-50 text-orange-600" icon="chart" />
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <PaginationControls
              totalItems={exercises.length}
              pageSize={pageSize}
              currentPage={currentPage}
              onPageSizeChange={changePageSize}
              onPageChange={setCurrentPage}
              itemLabel="ασκήσεις"
              variant="summary"
            />
          </div>

          <Card className="mt-5 overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="h-16 border-b border-slate-200 text-left text-sm font-extrabold">
                  <th className="px-6">Άσκηση</th>
                  <th className="px-5">Μυϊκή Ομάδα</th>
                  <th className="px-5">Εξοπλισμός</th>
                  <th className="px-5">Επίπεδο</th>
                  <th className="px-5">Τύπος</th>
                  <th className="px-5">Σε Προγράμματα</th>
                  <th className="px-5">Ενέργειες</th>
                </tr>
              </thead>
              <tbody>
                {paginatedExercises.map((exercise) => (
                  <tr key={exercise.id} className="h-[82px] border-b border-slate-200 last:border-b-0">
                    <td className="px-6">
                      <button onClick={() => openExercise(exercise, 'view')} className="flex items-center gap-4 text-left font-extrabold text-slate-950 hover:text-red-600">
                        <ExerciseImage exercise={exercise} />
                        {exercise.name}
                      </button>
                    </td>
                    <td className="px-5 text-sm text-slate-700">{exercise.muscleGroup}</td>
                    <td className="px-5 text-sm text-slate-700">{exercise.equipment}</td>
                    <td className="px-5"><LevelBadge level={exercise.level} /></td>
                    <td className="px-5 text-sm text-slate-700">{exercise.type}</td>
                    <td className="px-5 text-sm font-bold text-slate-700">{exercise.programsCount || 0}</td>
                    <td className="px-5">
                      <div className="flex items-center gap-3">
                        <IconButton label="Προβολή" icon="eye" onClick={() => openExercise(exercise, 'view')} />
                        <IconButton label="Επεξεργασία" icon="edit" onClick={() => openExercise(exercise, 'edit')} />
                        <IconButton label="Διαγραφή" icon="trash" onClick={() => deleteExercise(exercise)} className="text-red-600 hover:bg-red-50 hover:text-red-700" />
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && exercises.length === 0 && (
                  <tr>
                    <td colSpan="7" className="h-32 px-6 text-center font-semibold text-slate-500">Δεν βρέθηκαν ασκήσεις με αυτά τα φίλτρα.</td>
                  </tr>
                )}
              </tbody>
            </table>
            <PaginationControls
              totalItems={exercises.length}
              pageSize={pageSize}
              currentPage={currentPage}
              onPageSizeChange={changePageSize}
              onPageChange={setCurrentPage}
              itemLabel="ασκήσεις"
              variant="pages"
            />
          </Card>
        </div>
      </main>

      {selected && editForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-8">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-2xl font-extrabold">{isCreating ? 'Νέα Άσκηση' : editForm.name}</h2>
                <p className="mt-1 text-sm text-slate-600">{editForm.muscleGroup} • {editForm.equipment}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setSelected(null)} className="grid h-10 w-10 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-red-600"><Icon name="close" /></button>
              </div>
            </div>
            <div className="grid grid-cols-12 gap-6 p-6">
              <div className="col-span-5">
                <div className="h-72 overflow-hidden rounded-lg bg-slate-100">
                  <ExerciseImage exercise={{ ...selected, name: editForm.name, imageUrl: editForm.imageUrl }} large />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Info label="Επίπεδο" value={editForm.level} />
                  <Info label="Τύπος" value={editForm.type} />
                  <Info label="Σε Προγράμματα" value={editForm.programsCount || 0} />
                  <Info label="Video" value={editForm.videoUrl ? 'Έτοιμο για embed' : 'Δεν έχει μπει ακόμα'} />
                </div>
              </div>
              <div className="col-span-7">
                {isReadOnly ? (
                  <div>
                    <div className="grid grid-cols-2 gap-4">
                      <Info label="Όνομα" value={editForm.name} />
                      <Info label="Μυϊκή ομάδα" value={editForm.muscleGroup} />
                      <Info label="Εξοπλισμός" value={editForm.equipment} />
                      <Info label="Επίπεδο" value={editForm.level} />
                      <Info label="Τύπος" value={editForm.type} />
                      <Info label="Σε προγράμματα" value={editForm.programsCount || 0} />
                    </div>
                    <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <h3 className="font-extrabold">Περιγραφή / Πώς γίνεται</h3>
                      <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{editForm.instructions || 'Δεν έχει προστεθεί περιγραφή.'}</p>
                    </div>
                    <VideoEmbed url={editForm.videoUrl} />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <EditInput label="Όνομα" value={editForm.name} onChange={(value) => updateEditField('name', value)} />
                      <EditSelect label="Μυϊκή ομάδα" value={editForm.muscleGroup} onChange={(value) => updateEditField('muscleGroup', value)} options={muscleGroupOptions} />
                      <EditSelect label="Εξοπλισμός" value={editForm.equipment} onChange={(value) => updateEditField('equipment', value)} options={equipmentOptions} />
                      <label className="block">
                        <span className="text-sm font-bold text-slate-700">Επίπεδο</span>
                        <select value={editForm.level} onChange={(event) => updateEditField('level', event.target.value)} className="mt-2 h-11 w-full rounded-md border border-slate-200 px-4 outline-none focus:border-red-300">
                          <option value="Αρχάριο">Αρχάριο</option>
                          <option value="Μεσαίο">Μεσαίο</option>
                          <option value="Δύσκολο">Δύσκολο</option>
                        </select>
                      </label>
                      <EditSelect label="Τύπος" value={editForm.type} onChange={(value) => updateEditField('type', value)} options={typeOptions} />
                      <EditInput label="Σε προγράμματα" type="number" value={editForm.programsCount} onChange={(value) => updateEditField('programsCount', value)} />
                    </div>

                    <label className="mt-5 block">
                      <span className="text-sm font-bold text-slate-700">Περιγραφή / Πώς γίνεται</span>
                      <textarea
                        value={editForm.instructions}
                        onChange={(event) => updateEditField('instructions', event.target.value)}
                        className="mt-2 min-h-40 w-full rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-7 outline-none focus:border-red-300"
                      />
                    </label>

                    <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm font-bold text-slate-700">Thumbnail άσκησης</span>
                        <span className={`rounded-md px-3 py-1 text-xs font-bold ${editForm.imageUrl ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                          {editForm.imageUrl ? 'Έχει εικόνα' : 'Χωρίς εικόνα'}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-3">
                        <button onClick={openMediaPicker} className="flex h-11 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-bold hover:border-red-200 hover:text-red-600">
                          <Icon name="image" />
                          Media Library
                        </button>
                        <label className={`flex h-11 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-bold ${isCreating ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-red-200 hover:text-red-600'}`}>
                          <Icon name="upload" />
                          Upload thumbnail
                          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={uploadImage} disabled={isCreating || saving} className="hidden" />
                        </label>
                        <button onClick={clearThumbnail} disabled={!editForm.imageUrl || saving} className="h-11 rounded-md border border-red-200 bg-white px-4 text-sm font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40">
                          Αφαίρεση
                        </button>
                      </div>
                    </div>

                    <label className="mt-5 block text-sm font-bold text-slate-700">Video link / embed</label>
                    <input value={editForm.videoUrl} onChange={(e) => updateEditField('videoUrl', e.target.value)} placeholder="YouTube, Vimeo ή embed URL" className="mt-2 h-11 w-full rounded-md border border-slate-200 px-4 outline-none focus:border-red-300" />

                    {mediaMessage && (
                      <div className="mt-3 rounded-md bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                        {mediaMessage}
                      </div>
                    )}

                    <VideoEmbed url={editForm.videoUrl} />

                    <div className="mt-6 flex justify-end border-t border-slate-200 pt-5">
                      <button onClick={saveExercise} disabled={saving} className="h-11 rounded-md bg-red-600 px-6 text-sm font-bold text-white hover:bg-red-700 disabled:bg-slate-400">
                        {saving ? 'Αποθήκευση...' : isCreating ? 'Προσθήκη Άσκησης' : 'Αποθήκευση Άσκησης'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {mediaPickerOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/70 p-8">
          <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-2xl font-extrabold">Επιλογή από Media Library</h2>
                <p className="mt-1 text-sm text-slate-600">Διάλεξε φωτογραφία που είναι ήδη αποθηκευμένη στη βάση.</p>
              </div>
              <button onClick={() => setMediaPickerOpen(false)} className="grid h-10 w-10 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-red-600"><Icon name="close" /></button>
            </div>
            <div className="p-6">
              <input value={mediaSearch} onChange={(event) => setMediaSearch(event.target.value)} placeholder="Αναζήτηση φωτογραφίας ή φακέλου..." className="h-12 w-full rounded-lg border border-slate-200 px-4 outline-none focus:border-red-300" />
              <div className="mt-5 grid max-h-[58vh] grid-cols-4 gap-4 overflow-y-auto pr-2">
                {filteredMediaAssets.map((asset) => (
                  <button key={`${asset.kind}-${asset.id}`} onClick={() => chooseMediaAsset(asset)} className="overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-sm hover:border-red-300">
                    <div className="h-36 bg-slate-100">
                      <PickerImage asset={asset} />
                    </div>
                    <div className="p-3">
                      <div className="truncate font-bold">{asset.title}</div>
                      <div className="mt-1 truncate text-xs text-slate-500">{asset.folderName || asset.source}</div>
                    </div>
                  </button>
                ))}
              </div>
              {!filteredMediaAssets.length && <div className="mt-8 rounded-lg border border-dashed border-slate-300 p-8 text-center font-semibold text-slate-500">Δεν βρέθηκαν φωτογραφίες στη Media Library.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SelectFilter({ label, value, onChange, options, className }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${className} h-14 rounded-lg border border-slate-200 bg-white px-5 font-semibold text-slate-700 shadow-sm outline-none focus:border-red-300`}>
      <option value="">{label}: Όλες</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function EditInput({ label, value, onChange, type = 'text' }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-slate-200 px-4 outline-none focus:border-red-300"
      />
    </label>
  );
}

function EditSelect({ label, value, onChange, options }) {
  const selectOptions = value && !options.includes(value) ? [value, ...options] : options;

  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <select
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-slate-200 bg-white px-4 outline-none focus:border-red-300"
      >
        <option value="">Επιλογή</option>
        {selectOptions.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function StatCard({ label, value, note, tone, icon }) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-5">
        <span className={`grid h-16 w-16 place-items-center rounded-full ${tone}`}><Icon name={icon} className="h-8 w-8" /></span>
        <div>
          <p className="text-base font-semibold text-slate-600">{label}</p>
          <p className="mt-3 text-3xl font-extrabold">{value}</p>
          <p className="mt-3 text-sm text-slate-600">{note}</p>
        </div>
      </div>
    </Card>
  );
}

function IconButton({ label, icon, onClick, className = '' }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className={`grid h-9 w-9 place-items-center rounded-md text-slate-900 hover:bg-slate-100 hover:text-red-600 ${className}`}>
      <Icon name={icon} />
    </button>
  );
}

function ExerciseImage({ exercise, large = false }) {
  const [failed, setFailed] = useState(false);
  const sizeClass = large ? 'h-full w-full' : 'h-14 w-20 rounded-md';
  const src = normalizeImageUrl(exercise.imageUrl);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div className={`${sizeClass} grid place-items-center bg-slate-900 p-2 text-center text-[10px] font-extrabold uppercase leading-tight text-white`}>
        <Icon name="image" className={large ? 'mb-3 h-10 w-10' : 'hidden'} />
        {exercise.name}
      </div>
    );
  }

  return <img src={src} alt={exercise.name} className={`${sizeClass} object-cover bg-slate-200`} onError={() => setFailed(true)} />;
}

function PickerImage({ asset }) {
  const [failed, setFailed] = useState(false);
  const src = normalizeImageUrl(asset.url);

  if (!src || failed) {
    return <div className="grid h-full place-items-center bg-slate-900 p-3 text-center text-xs font-extrabold uppercase text-white">{asset.title}</div>;
  }

  return <img src={src} alt={asset.title} onError={() => setFailed(true)} className="h-full w-full object-cover" />;
}

function LevelBadge({ level }) {
  const styles = {
    'Αρχάριο': 'bg-emerald-50 text-emerald-700',
    'Μεσαίο': 'bg-amber-50 text-amber-700',
    'Δύσκολο': 'bg-red-50 text-red-700',
  };
  return <span className={`rounded-md px-3 py-1.5 text-sm font-bold ${styles[level] || 'bg-slate-100 text-slate-700'}`}>{level}</span>;
}

function Info({ label, value }) {
  return <div className="rounded-lg border border-slate-200 p-3"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 font-bold">{value}</div></div>;
}

function VideoEmbed({ url }) {
  const embedUrl = getVideoEmbedUrl(url);

  if (!url) {
    return (
      <div className="mt-5 flex h-44 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm font-semibold text-slate-500">
        <Icon name="play" className="mr-2 h-5 w-5" />
        Δεν έχει προστεθεί video ακόμα
      </div>
    );
  }

  if (!embedUrl) {
    return <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">Το link αποθηκεύεται, αλλά δεν υποστηρίζεται embed preview για αυτόν τον τύπο URL.</div>;
  }

  return (
    <div className="mt-5 aspect-video overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
      <iframe src={embedUrl} title="Exercise video" className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
    </div>
  );
}

function normalizeImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('/uploads')) return `${API_ORIGIN}${url}`;
  return url;
}

function getVideoEmbedUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtube.com')) {
      const id = parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).pop();
      return id ? `https://www.youtube.com/embed/${id}` : '';
    }
    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : '';
    }
    if (parsed.hostname.includes('vimeo.com')) {
      const id = parsed.pathname.split('/').filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : '';
    }
    return parsed.pathname.includes('/embed/') ? url : '';
  } catch {
    return '';
  }
}

function filterLocal(items, selectedFilters) {
  const searchValue = selectedFilters.search.trim().toLowerCase();
  return items.filter((exercise) => {
    const matchesSearch = !searchValue || [exercise.name, exercise.muscleGroup, exercise.equipment].some((value) => value?.toLowerCase().includes(searchValue));
    const matchesMuscle = !selectedFilters.muscleGroup || exercise.muscleGroup === selectedFilters.muscleGroup;
    const matchesEquipment = !selectedFilters.equipment || exercise.equipment === selectedFilters.equipment;
    const matchesLevel = !selectedFilters.level || exercise.level === selectedFilters.level;
    return matchesSearch && matchesMuscle && matchesEquipment && matchesLevel;
  });
}

function uniqueOptions(items, key) {
  return [...new Set(items.map((item) => item[key]).filter(Boolean))].sort();
}

function withDefaults(values, defaults) {
  return [...new Set([...(values || []), ...defaults].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'el'));
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

