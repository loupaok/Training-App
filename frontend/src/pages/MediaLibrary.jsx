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
  { label: 'Βιβλιοθήκη Ασκήσεων', path: '/exercises' },
  { label: 'Media Library', path: '/media-library', active: true },
  { label: 'Team', path: '/team' },
  { label: 'Analytics', path: '/analytics' },
  { label: 'Updates Πελατών', path: '/updates' },
  { label: 'Discord' },
  { label: 'Ειδοποιήσεις', path: '/notifications' },
  { label: 'Ρυθμίσεις' },
];

function Avatar({ initials, tone = 'bg-slate-900', size = 'h-12 w-12' }) {
  return <div className={`${size} ${tone} grid place-items-center rounded-full text-xs font-bold text-white shadow-sm`}>{initials}</div>;
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
            const className = `flex h-12 w-full items-center rounded-md px-4 text-left text-[15px] font-semibold ${section.active ? 'bg-red-600 text-white shadow-lg shadow-red-950/30' : 'text-slate-100 hover:bg-white/10'}`;
            return section.path ? <Link key={section.label} to={section.path} className={className}>{section.label}</Link> : <button key={section.label} className={className}>{section.label}</button>;
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
        <h1 className="text-2xl font-extrabold">Media Library</h1>
      </div>
      <TopbarActions user={user} logout={logout} Avatar={Avatar} />
    </header>
  );
}

export default function MediaLibrary() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [assets, setAssets] = useState([]);
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [search, setSearch] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', url: '', folderId: '' });
  const [renamingFolder, setRenamingFolder] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [dragAsset, setDragAsset] = useState(null);
  const [dropTarget, setDropTarget] = useState('');
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const loadLibrary = () => {
    Promise.all([api.get('/media'), api.get('/media/folders')])
      .then(([media, folderRows]) => {
        setAssets(media);
        setFolders(folderRows);
      })
      .catch(() => {
        setAssets([]);
        setFolders([]);
      });
  };

  useEffect(() => {
    loadLibrary();
  }, []);

  const folderCounts = useMemo(() => {
    return assets.reduce((counts, asset) => {
      const key = String(asset.folderId || 'uncategorized');
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
  }, [assets]);

  const filteredAssets = assets.filter((asset) => {
    const title = asset.title || '';
    const matchesSearch = !search || title.toLowerCase().includes(search.toLowerCase());
    const matchesFolder = !selectedFolder || String(asset.folderId || 'uncategorized') === selectedFolder;
    return matchesSearch && matchesFolder;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedFolder]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredAssets.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, filteredAssets.length, pageSize]);

  const paginatedAssets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAssets.slice(start, start + pageSize);
  }, [currentPage, filteredAssets, pageSize]);

  const customFolders = folders.filter((folder) => folder.source === 'custom');
  const exerciseFolders = folders.filter((folder) => folder.source === 'exercise');
  const allFolders = [...customFolders, ...exerciseFolders];

  const changePageSize = (size) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await api.post('/media/folders', { name: newFolderName.trim() });
      setNewFolderName('');
      setMessage('Ο φάκελος δημιουργήθηκε.');
      loadLibrary();
    } catch (error) {
      setMessage(error.message || 'Δεν δημιουργήθηκε ο φάκελος.');
    }
  };

  const openRenameFolder = (folder) => {
    if (folder.source !== 'custom') return;
    setRenamingFolder(folder);
    setRenameValue(folder.name);
  };

  const saveRenameFolder = async () => {
    if (!renamingFolder || !renameValue.trim()) return;
    try {
      await api.put(`/media/folders/${renamingFolder.id}`, { name: renameValue.trim() });
      setRenamingFolder(null);
      setRenameValue('');
      setMessage('Ο φάκελος μετονομάστηκε.');
      loadLibrary();
    } catch (error) {
      setMessage(error.message || 'Δεν έγινε μετονομασία φακέλου.');
    }
  };

  const deleteFolder = async (folder) => {
    if (folder.source !== 'custom') return;
    const confirmed = window.confirm(`Να διαγραφεί ο φάκελος "${folder.name}"; Τα media θα μείνουν χωρίς φάκελο.`);
    if (!confirmed) return;

    try {
      await api.delete(`/media/folders/${folder.id}`);
      if (selectedFolder === String(folder.id)) setSelectedFolder('');
      setMessage('Ο φάκελος διαγράφηκε.');
      loadLibrary();
    } catch (error) {
      setMessage(error.message || 'Δεν έγινε διαγραφή φακέλου.');
    }
  };

  const moveAssetToFolder = async (asset, folderId) => {
    if (!asset) return;
    if (asset.kind !== 'media_asset') {
      setMessage('Οι φωτογραφίες που είναι δεμένες απευθείας σε άσκηση δεν μετακινούνται. Ανέβασε ή αρχειοθέτησε την εικόνα ως media asset.');
      return;
    }

    try {
      await api.put(`/media/${asset.kind}/${asset.id}`, {
        title: asset.title,
        url: asset.url,
        folderId: folderId === 'uncategorized' ? '' : folderId,
      });
      setAssets((items) => items.map((item) => {
        if (item.kind !== asset.kind || item.id !== asset.id) return item;
        const folder = customFolders.find((row) => String(row.id) === String(folderId));
        return {
          ...item,
          folderId: folderId === 'uncategorized' ? null : folderId,
          folderName: folderId === 'uncategorized' ? null : folder?.name || item.folderName,
        };
      }));
      setMessage('Η φωτογραφία μετακινήθηκε.');
    } catch (error) {
      setMessage(error.message || 'Δεν έγινε μετακίνηση φωτογραφίας.');
    }
  };

  const handleFolderDrop = async (event, folderId) => {
    event.preventDefault();
    await moveAssetToFolder(dragAsset, folderId);
    setDragAsset(null);
    setDropTarget('');
  };

  const uploadAsset = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage('Συμπίεση και ανέβασμα media...');
    const compressedFile = await compressImageFile(file, { maxWidth: 1800, maxHeight: 1800, quality: 0.84 });
    const formData = new FormData();
    formData.append('file', compressedFile);
    formData.append('title', file.name.replace(/\.[^.]+$/, ''));
    formData.append('assetType', file.type.includes('svg') ? 'icon' : 'photo');
    if (selectedFolder && !selectedFolder.startsWith('muscle-') && selectedFolder !== 'uncategorized') {
      formData.append('folderId', selectedFolder);
    }

    try {
      await api.upload('/media/upload', formData);
      setMessage(`Το media αποθηκεύτηκε. ${formatBytes(file.size)} -> ${formatBytes(compressedFile.size)}`);
      loadLibrary();
    } catch (error) {
      setMessage(error.message || 'Το upload απέτυχε.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const openEdit = (asset) => {
    setEditing(asset);
    setEditForm({
      title: asset.title,
      url: asset.url || '',
      folderId: asset.kind === 'media_asset' ? (asset.folderId || '') : '',
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await api.put(`/media/${editing.kind}/${editing.id}`, editForm);
      setEditing(null);
      setMessage('Το media ενημερώθηκε στη βάση.');
      loadLibrary();
    } catch (error) {
      setMessage(error.message || 'Δεν έγινε αποθήκευση.');
    }
  };

  const deleteAsset = async (asset) => {
    try {
      await api.delete(`/media/${asset.kind}/${asset.id}`);
      setMessage(asset.kind === 'exercise_image' ? 'Η φωτογραφία αφαιρέθηκε από την άσκηση.' : 'Το media διαγράφηκε.');
      loadLibrary();
    } catch (error) {
      setMessage(error.message || 'Δεν έγινε διαγραφή.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      {sidebarOpen && <Sidebar user={user} />}
      <Topbar user={user} logout={logout} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((value) => !value)} />

      <main className={`${sidebarOpen ? 'ml-[300px]' : 'ml-0'} pt-[86px] transition-all duration-200`}>
        <div className="px-10 py-7">
          <div className="mb-7 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 text-sm">
                <Link to="/dashboard" className="font-semibold text-blue-600">Dashboard</Link>
                <span className="text-slate-400">›</span>
                <span className="text-slate-600">Media Library</span>
              </div>
              <h2 className="mt-5 text-3xl font-extrabold">Φωτογραφίες & Εικονίδια</h2>
            </div>
            <label className={`flex h-12 cursor-pointer items-center gap-3 rounded-md px-6 font-bold text-white shadow-lg shadow-red-200 ${uploading ? 'bg-slate-400' : 'bg-red-600 hover:bg-red-700'}`}>
              + {uploading ? 'Uploading...' : 'Upload Media'}
              <input type="file" accept="image/*" onChange={uploadAsset} className="hidden" />
            </label>
          </div>

          {message && <div className="mb-5 rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700 shadow-sm">{message}</div>}

          <div className="grid grid-cols-12 gap-5">
            <section className="col-span-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-extrabold">Φάκελοι</h3>
              <div className="mt-4 flex gap-2">
                <input value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} placeholder="Νέος φάκελος" className="h-10 min-w-0 flex-1 rounded-md border border-slate-200 px-3 outline-none focus:border-red-300" />
                <button onClick={createFolder} className="h-10 rounded-md bg-red-600 px-3 text-sm font-bold text-white hover:bg-red-700">Add</button>
              </div>
              <FolderButton label="Όλα τα media" active={!selectedFolder} count={assets.length} onClick={() => setSelectedFolder('')} />
              <FolderButton
                label="Χωρίς φάκελο"
                active={selectedFolder === 'uncategorized'}
                count={folderCounts.uncategorized || 0}
                onClick={() => setSelectedFolder('uncategorized')}
                canDrop={Boolean(dragAsset)}
                isDropTarget={dropTarget === 'uncategorized'}
                onDragEnter={() => setDropTarget('uncategorized')}
                onDragLeave={() => setDropTarget('')}
                onDrop={(event) => handleFolderDrop(event, 'uncategorized')}
              />

              <div className="mt-5 text-xs font-extrabold uppercase text-slate-500">Custom Folders</div>
              <div className="max-h-[420px] overflow-y-auto pr-1">
                {allFolders.map((folder) => (
                  <FolderButton
                    key={folder.id}
                    label={folder.name}
                    active={selectedFolder === String(folder.id)}
                    count={folderCounts[String(folder.id)] || 0}
                    canManage={folder.source === 'custom'}
                    canDrop={folder.source === 'custom' && Boolean(dragAsset)}
                    isDropTarget={dropTarget === String(folder.id)}
                    onClick={() => setSelectedFolder(String(folder.id))}
                    onRename={() => openRenameFolder(folder)}
                    onDelete={() => deleteFolder(folder)}
                    onDragEnter={() => setDropTarget(String(folder.id))}
                    onDragLeave={() => setDropTarget('')}
                    onDrop={(event) => handleFolderDrop(event, String(folder.id))}
                  />
                ))}
              </div>
            </section>

            <section className="col-span-9">
              <div className="grid grid-cols-12 gap-5">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Αναζήτηση media..." className="col-span-11 h-14 rounded-lg border border-slate-200 bg-white px-5 outline-none focus:border-red-300" />
                <button onClick={() => { setSearch(''); setSelectedFolder(''); }} className="col-span-1 h-14 rounded-lg border border-slate-200 bg-white font-bold hover:border-red-200 hover:text-red-600">Reset</button>
              </div>

              <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <PaginationControls
                  totalItems={filteredAssets.length}
                  pageSize={pageSize}
                  currentPage={currentPage}
                  onPageSizeChange={changePageSize}
                  onPageChange={setCurrentPage}
                  itemLabel="media"
                  variant="summary"
                />
              </div>

              <div className="mt-7 grid grid-cols-3 gap-5">
                {paginatedAssets.map((asset) => (
                  <section
                    key={`${asset.kind}-${asset.id}`}
                    draggable={asset.kind === 'media_asset'}
                    onDragStart={(event) => {
                      setDragAsset(asset);
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => {
                      setDragAsset(null);
                      setDropTarget('');
                    }}
                    className={`overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${asset.kind === 'media_asset' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  >
                    <div className="h-44 bg-slate-100"><MediaPreview asset={asset} /></div>
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-extrabold">{asset.title}</h3>
                          <p className="mt-1 text-sm text-slate-500">{asset.folderName || asset.source}</p>
                        </div>
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{asset.kind}</span>
                      </div>
                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <button onClick={() => openEdit(asset)} className="h-10 rounded-md border border-slate-200 font-bold hover:border-red-200 hover:text-red-600">Edit</button>
                        <button onClick={() => deleteAsset(asset)} className="h-10 rounded-md border border-red-200 font-bold text-red-600 hover:bg-red-50">Delete</button>
                      </div>
                    </div>
                  </section>
                ))}
              </div>

              {!filteredAssets.length && <div className="mt-10 rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center font-semibold text-slate-500">Δεν βρέθηκαν media.</div>}
              <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <PaginationControls
                  totalItems={filteredAssets.length}
                  pageSize={pageSize}
                  currentPage={currentPage}
                  onPageSizeChange={changePageSize}
                  onPageChange={setCurrentPage}
                  itemLabel="media"
                  variant="pages"
                />
              </div>
            </section>
          </div>
        </div>
      </main>

      {renamingFolder && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-8">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-extrabold">Rename Folder</h2>
              <button onClick={() => setRenamingFolder(null)} className="text-3xl text-slate-500 hover:text-red-600">×</button>
            </div>
            <div className="mt-6 space-y-4">
              <EditInput label="Όνομα φακέλου" value={renameValue} onChange={setRenameValue} />
              <div className="flex justify-end gap-3">
                <button onClick={() => setRenamingFolder(null)} className="h-11 rounded-md border border-slate-200 px-6 font-bold hover:border-red-200 hover:text-red-600">Άκυρο</button>
                <button onClick={saveRenameFolder} className="h-11 rounded-md bg-red-600 px-6 font-bold text-white hover:bg-red-700">Αποθήκευση</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-8">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-extrabold">Edit Media</h2>
              <button onClick={() => setEditing(null)} className="text-3xl text-slate-500 hover:text-red-600">×</button>
            </div>
            <div className="mt-6 space-y-4">
              <EditInput label="Τίτλος" value={editForm.title} onChange={(value) => setEditForm((form) => ({ ...form, title: value }))} />
              <EditInput label="URL" value={editForm.url} onChange={(value) => setEditForm((form) => ({ ...form, url: value }))} />
              {editing.kind === 'media_asset' && (
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Φάκελος</span>
                  <select value={editForm.folderId || ''} onChange={(e) => setEditForm((form) => ({ ...form, folderId: e.target.value }))} className="mt-2 h-11 w-full rounded-md border border-slate-200 px-4 outline-none focus:border-red-300">
                    <option value="">Χωρίς φάκελο</option>
                    {customFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                  </select>
                </label>
              )}
              <button onClick={saveEdit} className="h-11 rounded-md bg-red-600 px-6 font-bold text-white hover:bg-red-700">Αποθήκευση</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FolderButton({ label, active, count, onClick, canManage = false, canDrop = false, isDropTarget = false, onRename, onDelete, onDragEnter, onDragLeave, onDrop }) {
  return (
    <div
      onDragOver={(event) => {
        if (!canDrop) return;
        event.preventDefault();
      }}
      onDragEnter={(event) => {
        if (!canDrop) return;
        event.preventDefault();
        onDragEnter();
      }}
      onDragLeave={() => {
        if (canDrop) onDragLeave();
      }}
      onDrop={(event) => {
        if (!canDrop) return;
        onDrop(event);
      }}
      className={`mt-2 flex w-full items-center rounded-md text-sm font-semibold ${active ? 'bg-red-50 text-red-700' : 'text-slate-700 hover:bg-slate-50'} ${isDropTarget ? 'ring-2 ring-red-300' : ''}`}
    >
      <button onClick={onClick} className="flex min-w-0 flex-1 items-center justify-between px-3 py-2 text-left">
        <span className="truncate">{label}</span>
        <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{count}</span>
      </button>
      {canManage && (
        <div className="mr-2 flex shrink-0 items-center gap-1">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onRename();
            }}
            className="rounded px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-red-600"
          >
            Rename
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="rounded px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-100"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function EditInput({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-slate-200 px-4 outline-none focus:border-red-300" />
    </label>
  );
}

function MediaPreview({ asset }) {
  const src = normalizeUrl(asset.url);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <div className="grid h-full place-items-center bg-slate-900 p-4 text-center text-sm font-extrabold uppercase text-white">{asset.title}</div>;
  }

  return <img src={src} alt={asset.title} onError={() => setFailed(true)} className="h-full w-full object-cover" />;
}

function normalizeUrl(url) {
  if (!url) return '';
  if (url.startsWith('/uploads')) return `${API_ORIGIN}${url}`;
  return url;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
