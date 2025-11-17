import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

function useAuth() {
  const [token, setToken] = useState(localStorage.getItem('tp_token') || '')
  const [user, setUser] = useState(localStorage.getItem('tp_user') ? JSON.parse(localStorage.getItem('tp_user')) : null)
  const isAuthed = !!token
  const headers = useMemo(() => token ? { Authorization: `Bearer ${token}` } : {}, [token])
  const login = async (email, password) => {
    const form = new URLSearchParams()
    form.append('username', email)
    form.append('password', password)
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form
    })
    if (!res.ok) throw new Error('Identifiants invalides')
    const data = await res.json()
    localStorage.setItem('tp_token', data.access_token)
    localStorage.setItem('tp_user', JSON.stringify(data.user))
    setToken(data.access_token)
    setUser(data.user)
  }
  const logout = () => {
    localStorage.removeItem('tp_token')
    localStorage.removeItem('tp_user')
    setToken('')
    setUser(null)
  }
  return { token, user, isAuthed, headers, login, logout }
}

function Guard({ roles, children }) {
  const navigate = useNavigate()
  const { isAuthed, user } = useAuth()
  useEffect(() => {
    if (!isAuthed) navigate('/login')
    if (roles && user && !roles.includes(user.role)) navigate('/')
  }, [isAuthed, user])
  return children
}

function Layout({ children }) {
  const { user, logout } = useAuth()
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto flex items-center justify-between p-4">
          <Link to="/" className="font-bold">TransPublic</Link>
          <nav className="flex gap-4 text-sm">
            <Link to="/" className="hover:underline">Tableau de bord</Link>
            <Link to="/vehicles" className="hover:underline">Véhicules</Link>
            <Link to="/assignments" className="hover:underline">Affectations</Link>
            <Link to="/maintenance" className="hover:underline">Entretiens</Link>
            <Link to="/insurance" className="hover:underline">Assurances</Link>
            <Link to="/fuel" className="hover:underline">Carburant</Link>
            <Link to="/reports" className="hover:underline">Rapports</Link>
            {user?.role === 'admin' && <Link to="/users" className="hover:underline">Utilisateurs</Link>}
          </nav>
          <div className="text-sm flex items-center gap-3">
            {user ? <>
              <span>{user.nom} · {user.role}</span>
              <button onClick={logout} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded">Quitter</button>
            </> : <Link to="/login">Connexion</Link>}
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-4">
        {children}
      </main>
    </div>
  )
}

function LoginPage() {
  const { login, isAuthed } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('admin@demo.fr')
  const [password, setPassword] = useState('admin')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isAuthed) navigate('/')
  }, [isAuthed])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await login(email, password)
      navigate('/')
    } catch (e) {
      setError(e.message)
    }
  }
  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-blue-50 to-slate-100">
      <form onSubmit={submit} className="bg-white shadow rounded p-6 w-96 space-y-4">
        <h1 className="text-2xl font-bold">Connexion</h1>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div>
          <label className="block text-sm">Email</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} className="border w-full px-3 py-2 rounded" />
        </div>
        <div>
          <label className="block text-sm">Mot de passe</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="border w-full px-3 py-2 rounded" />
        </div>
        <button className="w-full bg-slate-900 text-white py-2 rounded">Se connecter</button>
        <p className="text-xs text-slate-600">Astuce: en première utilisation, créez un compte admin via l'API /auth/register</p>
      </form>
    </div>
  )
}

function Dashboard() {
  const { headers } = useAuth()
  const [data, setData] = useState(null)
  useEffect(() => {
    fetch(`${API}/dashboard`, { headers }).then(r=>r.json()).then(setData)
  }, [])
  if (!data) return <p>Chargement...</p>
  return (
    <div className="grid md:grid-cols-4 gap-4">
      <Stat title="Nombre véhicules" value={data.nombre_vehicules} />
      <Stat title="Actifs" value={data.vehicules_actifs} />
      <Stat title="En maintenance" value={data.vehicules_en_maintenance} />
      <Stat title="Coûts entretiens (mois)" value={`€ ${data.couts_entretiens_mois.toFixed(2)}`} />
      <div className="md:col-span-4 bg-white rounded p-4 border">
        <h3 className="font-semibold mb-2">Assurances à risque</h3>
        <ul className="text-sm list-disc pl-5">
          {data.assurances_a_risque.map(a => <li key={a.id}>{a.assureur} · fin {a.date_fin}</li>)}
        </ul>
      </div>
    </div>
  )
}

function Stat({ title, value }) {
  return (
    <div className="bg-white rounded p-4 border">
      <div className="text-slate-500 text-sm">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}

function Vehicles() {
  const { headers } = useAuth()
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const [statut, setStatut] = useState('')
  const [departement, setDept] = useState('')
  const [form, setForm] = useState({ immatriculation:'', marque:'', modele:'', annee:2020, kilometrage_initial:0, type:'voiture', statut:'actif', departement:'', notes:'' })

  const search = () => {
    const params = new URLSearchParams()
    if (q) params.append('q', q)
    if (statut) params.append('statut', statut)
    if (departement) params.append('departement', departement)
    fetch(`${API}/vehicles?${params.toString()}`, { headers }).then(r=>r.json()).then(setItems)
  }
  useEffect(search, [])

  const create = async () => {
    await fetch(`${API}/vehicles`, { method:'POST', headers: { 'Content-Type':'application/json', ...headers }, body: JSON.stringify(form) })
    setForm({ immatriculation:'', marque:'', modele:'', annee:2020, kilometrage_initial:0, type:'voiture', statut:'actif', departement:'', notes:'' })
    search()
  }

  return (
    <div className="grid gap-4">
      <div className="bg-white border rounded p-3 grid md:grid-cols-4 gap-2 items-end">
        <div>
          <label className="text-xs">Recherche</label>
          <input value={q} onChange={e=>setQ(e.target.value)} className="w-full border px-2 py-1 rounded" />
        </div>
        <div>
          <label className="text-xs">Statut</label>
          <select value={statut} onChange={e=>setStatut(e.target.value)} className="w-full border px-2 py-1 rounded">
            <option value="">Tous</option>
            <option>actif</option>
            <option>inactif</option>
            <option>maintenance</option>
            <option>assigne</option>
          </select>
        </div>
        <div>
          <label className="text-xs">Département</label>
          <input value={departement} onChange={e=>setDept(e.target.value)} className="w-full border px-2 py-1 rounded" />
        </div>
        <button onClick={search} className="bg-slate-900 text-white py-2 px-3 rounded">Filtrer</button>
      </div>

      <div className="bg-white border rounded p-3">
        <h3 className="font-semibold mb-2">Nouveau véhicule</h3>
        <div className="grid md:grid-cols-4 gap-2">
          {['immatriculation','marque','modele','annee','kilometrage_initial','type','statut','departement'].map(key => (
            <div key={key}>
              <label className="text-xs capitalize">{key.replace('_',' ')}</label>
              {key==='type' ? (
                <select value={form.type} onChange={e=>setForm({...form, type:e.target.value})} className="w-full border px-2 py-1 rounded"><option>voiture</option><option>utilitaire</option></select>
              ) : key==='statut' ? (
                <select value={form.statut} onChange={e=>setForm({...form, statut:e.target.value})} className="w-full border px-2 py-1 rounded"><option>actif</option><option>inactif</option><option>maintenance</option><option>assigne</option></select>
              ) : (
                <input value={form[key]} onChange={e=>setForm({...form, [key]: key.includes('annee')||key.includes('kilometrage')? Number(e.target.value): e.target.value})} className="w-full border px-2 py-1 rounded" />
              )}
            </div>
          ))}
          <div className="md:col-span-4">
            <label className="text-xs">Notes</label>
            <textarea value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} className="w-full border px-2 py-1 rounded" />
          </div>
        </div>
        <button onClick={create} className="mt-2 bg-green-600 text-white px-3 py-2 rounded">Créer</button>
      </div>

      <div className="bg-white border rounded">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="p-2">Immatriculation</th><th>Marque</th><th>Modèle</th><th>Année</th><th>Statut</th><th>Département</th>
            </tr>
          </thead>
          <tbody>
            {items.map(v => (
              <tr key={v.id} className="border-t">
                <td className="p-2">{v.immatriculation}</td>
                <td>{v.marque}</td>
                <td>{v.modele}</td>
                <td>{v.annee}</td>
                <td>{v.statut}</td>
                <td>{v.departement}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Assignments() {
  const { headers } = useAuth()
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ vehicule_id:'', utilisateur_id:'', date_debut:'', date_fin_prevue:'', motif:'' })
  const load = () => fetch(`${API}/assignments`, { headers }).then(r=>r.json()).then(setItems)
  useEffect(load, [])
  const create = async () => {
    const payload = { ...form, date_debut: form.date_debut||new Date().toISOString().slice(0,10), date_fin_prevue: form.date_fin_prevue||null }
    await fetch(`${API}/assignments`, { method:'POST', headers: { 'Content-Type':'application/json', ...headers }, body: JSON.stringify(payload) })
    setForm({ vehicule_id:'', utilisateur_id:'', date_debut:'', date_fin_prevue:'', motif:'' })
    load()
  }
  return (
    <div className="grid gap-4">
      <div className="bg-white border rounded p-3 grid md:grid-cols-5 gap-2 items-end">
        {['vehicule_id','utilisateur_id','date_debut','date_fin_prevue','motif'].map(k => (
          <div key={k}>
            <label className="text-xs capitalize">{k.replace('_',' ')}</label>
            <input type={k.includes('date')? 'date': 'text'} value={form[k]} onChange={e=>setForm({...form, [k]: e.target.value})} className="w-full border px-2 py-1 rounded" />
          </div>
        ))}
        <button onClick={create} className="bg-green-600 text-white px-3 py-2 rounded">Assigner</button>
      </div>
      <div className="bg-white border rounded">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left"><tr><th className="p-2">Véhicule</th><th>Utilisateur</th><th>Début</th><th>Fin prévue</th><th>Motif</th></tr></thead>
          <tbody>
            {items.map(a => <tr key={a.id} className="border-t"><td className="p-2">{a.vehicule_id}</td><td>{a.utilisateur_id}</td><td>{a.date_debut}</td><td>{a.date_fin_prevue||'-'}</td><td>{a.motif||'-'}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MaintenancePage() {
  const { headers } = useAuth()
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ vehicule_id:'', date:'', type:'revision', garage:'', cout:0, description:'', kilometrage:0 })
  const load = () => fetch(`${API}/maintenances`, { headers }).then(r=>r.json()).then(setItems)
  useEffect(load, [])
  const create = async () => {
    const payload = { ...form, date: form.date||new Date().toISOString().slice(0,10), cout: Number(form.cout), kilometrage: Number(form.kilometrage) }
    await fetch(`${API}/maintenances`, { method:'POST', headers: { 'Content-Type':'application/json', ...headers }, body: JSON.stringify(payload) })
    setForm({ vehicule_id:'', date:'', type:'revision', garage:'', cout:0, description:'', kilometrage:0 })
    load()
  }
  return (
    <div className="grid gap-4">
      <div className="bg-white border rounded p-3 grid md:grid-cols-6 gap-2 items-end">
        {['vehicule_id','date','type','garage','cout','kilometrage'].map(k => (
          <div key={k}>
            <label className="text-xs capitalize">{k}</label>
            {k==='type'? (
              <select value={form.type} onChange={e=>setForm({...form, type:e.target.value})} className="w-full border px-2 py-1 rounded"><option>revision</option><option>reparation</option></select>
            ): (
              <input type={k==='date'? 'date':'text'} value={form[k]} onChange={e=>setForm({...form, [k]: k==='cout'||k==='kilometrage'? Number(e.target.value): e.target.value})} className="w-full border px-2 py-1 rounded" />
            )}
          </div>
        ))}
        <div className="md:col-span-6">
          <label className="text-xs">Description</label>
          <textarea value={form.description} onChange={e=>setForm({...form, description:e.target.value})} className="w-full border px-2 py-1 rounded" />
        </div>
        <button onClick={create} className="bg-green-600 text-white px-3 py-2 rounded">Ajouter</button>
      </div>
      <div className="bg-white border rounded">
        <table className="w-full text-sm"><thead className="bg-slate-100 text-left"><tr><th className="p-2">Véhicule</th><th>Date</th><th>Type</th><th>Garage</th><th>Coût</th></tr></thead><tbody>
          {items.map(m=> <tr key={m.id} className="border-t"><td className="p-2">{m.vehicule_id}</td><td>{m.date}</td><td>{m.type}</td><td>{m.garage||'-'}</td><td>€ {m.cout}</td></tr>)}
        </tbody></table>
      </div>
    </div>
  )
}

function InsurancePage() {
  const { headers } = useAuth()
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ vehicule_id:'', assureur:'', numero_contrat:'', date_debut:'', date_fin:'', prime:0, fichier:null })
  const load = () => fetch(`${API}/insurances`, { headers }).then(r=>r.json()).then(setItems)
  useEffect(load, [])
  const create = async () => {
    const fd = new FormData()
    Object.entries({ ...form, prime: String(form.prime) }).forEach(([k,v])=>{
      if (k==='fichier') return
      if (v!==undefined && v!==null) fd.append(k, v)
    })
    if (form.fichier) fd.append('fichier_document', form.fichier)
    await fetch(`${API}/insurances`, { method:'POST', headers, body: fd })
    setForm({ vehicule_id:'', assureur:'', numero_contrat:'', date_debut:'', date_fin:'', prime:0, fichier:null })
    load()
  }
  return (
    <div className="grid gap-4">
      <div className="bg-white border rounded p-3 grid md:grid-cols-7 gap-2 items-end">
        {['vehicule_id','assureur','numero_contrat','date_debut','date_fin','prime'].map(k => (
          <div key={k}>
            <label className="text-xs capitalize">{k.replace('_',' ')}</label>
            <input type={k.includes('date')? 'date':'text'} value={form[k]} onChange={e=>setForm({...form, [k]: k==='prime'? Number(e.target.value): e.target.value})} className="w-full border px-2 py-1 rounded" />
          </div>
        ))}
        <div>
          <label className="text-xs">Document</label>
          <input type="file" onChange={e=>setForm({...form, fichier:e.target.files[0]})} className="w-full" />
        </div>
        <button onClick={create} className="bg-green-600 text-white px-3 py-2 rounded">Créer</button>
      </div>
      <div className="bg-white border rounded">
        <table className="w-full text-sm"><thead className="bg-slate-100 text-left"><tr><th className="p-2">Véhicule</th><th>Assureur</th><th>Fin</th><th>Prime</th><th>Doc</th></tr></thead><tbody>
          {items.map(i=> <tr key={i.id} className="border-t"><td className="p-2">{i.vehicule_id}</td><td>{i.assureur}</td><td>{i.date_fin}</td><td>€ {i.prime}</td><td>{i.fichier_document? <a href={`${API}/insurances/${i.id}/download`} className="text-blue-600">Télécharger</a>: '-'}</td></tr>)}
        </tbody></table>
      </div>
    </div>
  )
}

function FuelPage() {
  const { headers } = useAuth()
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ vehicule_id:'', date:'', kilometrage:0, litres:0, cout:0 })
  const load = () => fetch(`${API}/fuels`, { headers }).then(r=>r.json()).then(setItems)
  useEffect(load, [])
  const create = async () => {
    const payload = { ...form, date: form.date||new Date().toISOString().slice(0,10), kilometrage: Number(form.kilometrage), litres: Number(form.litres), cout: Number(form.cout) }
    await fetch(`${API}/fuels`, { method:'POST', headers: { 'Content-Type':'application/json', ...headers }, body: JSON.stringify(payload) })
    setForm({ vehicule_id:'', date:'', kilometrage:0, litres:0, cout:0 })
    load()
  }
  return (
    <div className="grid gap-4">
      <div className="bg-white border rounded p-3 grid md:grid-cols-5 gap-2 items-end">
        {['vehicule_id','date','kilometrage','litres','cout'].map(k => (
          <div key={k}>
            <label className="text-xs capitalize">{k}</label>
            <input type={k==='date'? 'date':'text'} value={form[k]} onChange={e=>setForm({...form, [k]: ['kilometrage','litres','cout'].includes(k)? Number(e.target.value): e.target.value})} className="w-full border px-2 py-1 rounded" />
          </div>
        ))}
        <button onClick={create} className="bg-green-600 text-white px-3 py-2 rounded">Ajouter</button>
      </div>
      <div className="bg-white border rounded">
        <table className="w-full text-sm"><thead className="bg-slate-100 text-left"><tr><th className="p-2">Véhicule</th><th>Date</th><th>Km</th><th>Litres</th><th>Coût</th></tr></thead><tbody>
          {items.map(f=> <tr key={f.id} className="border-t"><td className="p-2">{f.vehicule_id}</td><td>{f.date}</td><td>{f.kilometrage}</td><td>{f.litres}</td><td>€ {f.cout}</td></tr>)}
        </tbody></table>
      </div>
    </div>
  )
}

function ReportsPage() {
  const { headers } = useAuth()
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [rows, setRows] = useState([])
  const run = async () => {
    const params = new URLSearchParams({ start, end })
    const data = await fetch(`${API}/reports/maintenance-costs?${params}`, { headers }).then(r=>r.json())
    setRows(data)
  }
  return (
    <div className="grid gap-4">
      <div className="bg-white border rounded p-3 flex gap-2 items-end">
        <div><label className="text-xs">Début</label><input type="date" value={start} onChange={e=>setStart(e.target.value)} className="border px-2 py-1 rounded"/></div>
        <div><label className="text-xs">Fin</label><input type="date" value={end} onChange={e=>setEnd(e.target.value)} className="border px-2 py-1 rounded"/></div>
        <button onClick={run} className="bg-slate-900 text-white px-3 py-2 rounded">Générer</button>
      </div>
      <div className="bg-white border rounded p-3">
        <h3 className="font-semibold mb-2">Coûts d’entretien par véhicule</h3>
        <ul className="text-sm list-disc pl-5">
          {rows.map(r=> <li key={r.vehicule_id}>{r.vehicule_id} · € {r.total}</li>)}
        </ul>
      </div>
    </div>
  )
}

function UsersPage() {
  const { headers } = useAuth()
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({ nom:'', email:'', mot_de_passe:'', role:'agent', departement:'' })
  const load = async () => {
    // simple list by calling assignments report of users not available, so list via backend direct endpoint later; for now use dashboard collections insight not available
    // We'll implement a minimal endpoint-free list by storing created users client-side prompt
  }
  const create = async () => {
    const res = await fetch(`${API}/auth/register`, { method:'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(form) })
    if (!res.ok) alert('Erreur de création')
    else alert('Utilisateur créé. Utilisez la page de connexion.')
  }
  return (
    <div className="grid gap-4">
      <div className="bg-white border rounded p-3 grid md:grid-cols-5 gap-2 items-end">
        {['nom','email','mot_de_passe','role','departement'].map(k => (
          <div key={k}>
            <label className="text-xs capitalize">{k.replace('_',' ')}</label>
            {k==='role' ? (
              <select value={form.role} onChange={e=>setForm({...form, role:e.target.value})} className="w-full border px-2 py-1 rounded"><option>admin</option><option>gestionnaire</option><option>agent</option></select>
            ) : (
              <input type={k==='mot_de_passe'? 'password':'text'} value={form[k]} onChange={e=>setForm({...form, [k]: e.target.value})} className="w-full border px-2 py-1 rounded" />
            )}
          </div>
        ))}
        <button onClick={create} className="bg-green-600 text-white px-3 py-2 rounded">Créer</button>
      </div>
      <p className="text-sm text-slate-600">Gestion des utilisateurs: création rapide ci-dessus. Pour des rôles/permissions avancés, nous pourrions ajouter la liste/édition/suppression.</p>
    </div>
  )
}

function SettingsPage() {
  const { headers } = useAuth()
  const [days, setDays] = useState(30)
  useEffect(()=>{ fetch(`${API}/settings`, { headers }).then(r=>r.json()).then(s=> setDays(s.alert_threshold_days)) },[])
  const save = async() => {
    await fetch(`${API}/settings`, { method:'PUT', headers: { 'Content-Type':'application/json', ...headers }, body: JSON.stringify({ alert_threshold_days: Number(days) }) })
    alert('Enregistré')
  }
  return (
    <div className="bg-white border rounded p-4 w-full max-w-lg">
      <h3 className="font-semibold mb-2">Paramètres</h3>
      <label className="text-sm">Alerte expiration assurance (jours)</label>
      <input type="number" value={days} onChange={e=>setDays(e.target.value)} className="border w-full px-2 py-1 rounded mt-1" />
      <button onClick={save} className="mt-3 bg-slate-900 text-white px-3 py-2 rounded">Sauvegarder</button>
    </div>
  )
}

function AppShell() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Layout><Dashboard /></Layout>} />
        <Route path="/vehicles" element={<Layout><Vehicles /></Layout>} />
        <Route path="/assignments" element={<Layout><Assignments /></Layout>} />
        <Route path="/maintenance" element={<Layout><MaintenancePage /></Layout>} />
        <Route path="/insurance" element={<Layout><InsurancePage /></Layout>} />
        <Route path="/fuel" element={<Layout><FuelPage /></Layout>} />
        <Route path="/reports" element={<Layout><ReportsPage /></Layout>} />
        <Route path="/users" element={<Layout><UsersPage /></Layout>} />
        <Route path="/settings" element={<Layout><SettingsPage /></Layout>} />
      </Routes>
    </BrowserRouter>
  )
}

export default AppShell
