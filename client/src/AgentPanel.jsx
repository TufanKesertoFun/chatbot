import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api, SOCKET_URL } from './api';
import { io } from 'socket.io-client';
import { createLogger } from './logger';
import { useI18n } from './i18n/context';
import { 
  Send, User, LayoutDashboard, MessageSquare, LogOut, Users, 
  Activity, BookOpen, Plus, Trash2, Settings, Sparkles, 
  ThumbsUp, ThumbsDown, Book, Bot, UserCheck, Globe, Power, RefreshCw, CircleHelp
} from 'lucide-react';

const LEAD_STATUS_OPTIONS = ['NEW', 'QUALIFIED', 'CONTACTED', 'WON', 'LOST'];
const LEAD_SOURCE_OPTIONS = ['WIDGET', 'SDK_API', 'MANUAL'];

function createEmptyLeadDraft() {
  return {
    status: 'NEW',
    source: 'WIDGET',
    fullName: '',
    email: '',
    phone: '',
    externalId: '',
    note: '',
  };
}

function buildLeadDraft(lead) {
  return {
    status: lead?.status || 'NEW',
    source: lead?.source || 'WIDGET',
    fullName: lead?.fullName || '',
    email: lead?.email || '',
    phone: lead?.phone || '',
    externalId: lead?.externalId || '',
    note: '',
  };
}

function Hint({ text }) {
  return (
    <div className="mt-1 flex items-start gap-1.5 text-xs text-slate-500">
      <CircleHelp size={12} className="mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function LoginScreen({ onLogin, t }) {
  const [mode, setMode] = useState('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('StrongPassword123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleReady, setGoogleReady] = useState(false);
  const googleButtonRef = useRef(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  const applyAuth = (data) => {
    onLogin(data.token, data.user);
  };

  const handleGoogleCredential = useCallback(async (credentialResponse) => {
    if (!credentialResponse?.credential) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/admin/google-auth', {
        credential: credentialResponse.credential,
        mode,
      });
      applyAuth(res.data);
    } catch (err) {
      setError(err?.response?.data?.error || t('login.failed'));
    } finally {
      setLoading(false);
    }
  }, [mode, t]);

  useEffect(() => {
    if (!googleClientId) return;
    if (window.google?.accounts?.id) {
      setGoogleReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleReady(true);
    script.onerror = () => setGoogleReady(false);
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [googleClientId]);

  useEffect(() => {
    if (!googleReady || !googleButtonRef.current || !googleClientId || !window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: handleGoogleCredential,
    });
    googleButtonRef.current.innerHTML = '';
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      width: 360,
      text: mode === 'signup' ? 'signup_with' : 'signin_with',
    });
  }, [googleReady, googleClientId, handleGoogleCredential, mode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = { email, password };
      const endpoint = mode === 'signup' ? '/admin/signup' : '/admin/login';
      const res = await api.post(endpoint, mode === 'signup' ? { ...payload, fullName } : payload);
      applyAuth(res.data);
    } catch (err) {
      setError(err?.response?.data?.error || t('login.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full bg-slate-900 flex items-center justify-center font-sans p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">{t('login.title')}</h2>
        <div className="mt-5 mb-4 grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`py-2 text-sm font-semibold rounded-lg transition ${mode === 'signin' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}
          >
            {t('login.signIn')}
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`py-2 text-sm font-semibold rounded-lg transition ${mode === 'signup' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}
          >
            {t('login.signUp')}
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full border p-3 rounded-lg"
              placeholder={t('login.fullName')}
            />
          )}
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border p-3 rounded-lg" placeholder={t('login.email')} />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border p-3 rounded-lg" placeholder={t('login.password')} />
          {mode === 'signup' && <div className="text-xs text-slate-500 text-left">{t('login.passwordRule')}</div>}
          {error && <div className="text-sm text-red-600 text-left">{error}</div>}
          <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-60">
            {loading ? t('login.signingIn') : (mode === 'signup' ? t('login.createAccount') : t('login.signIn'))}
          </button>
        </form>
        <div className="my-4 flex items-center gap-2 text-xs text-slate-400">
          <div className="h-px bg-slate-200 flex-1" />
          <span>{t('login.orContinue')}</span>
          <div className="h-px bg-slate-200 flex-1" />
        </div>
        {googleClientId ? (
          <div className="flex justify-center">
            <div ref={googleButtonRef} />
          </div>
        ) : (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
            {t('login.googleNotConfigured')}
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardView({ token, t, lang }) {
  const [stats, setStats] = useState(null);
  const [range, setRange] = useState('week');
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const reasonLabel = (reason) => {
    if (reason === 'NO_DATA') return t('dashboard.reasonNoData');
    if (reason === 'EXPLICIT_HUMAN_REQUEST') return t('dashboard.reasonHumanRequest');
    if (reason === 'NEGATIVE_SENTIMENT') return t('dashboard.reasonSentiment');
    if (reason === 'POLICY_BLOCK') return t('dashboard.reasonPolicy');
    return t('dashboard.reasonUnknown');
  };

  useEffect(() => {
    api.get(`/dashboard/stats?range=${range}`, { headers: { Authorization: `Bearer ${token}` } })
       .then(res => setStats(res.data)).catch(err => console.error(err));
  }, [token, range]);

  if (!stats) return <div className="p-8">{t('common.loading')}</div>;

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{t('dashboard.title')}</h1>
        <div className="flex gap-2">
          <button onClick={() => setRange('day')} className={`px-3 py-1.5 rounded text-xs font-bold ${range === 'day' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{t('dashboard.day')}</button>
          <button onClick={() => setRange('week')} className={`px-3 py-1.5 rounded text-xs font-bold ${range === 'week' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{t('dashboard.week')}</button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        {[
          { label: t('dashboard.activeConversations'), val: stats.activeConversations, icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-100' },
          { label: t('dashboard.totalConversations'), val: stats.totalConversations, icon: Users, color: 'text-amber-600', bg: 'bg-amber-100' },
          { label: t('dashboard.botSuccess'), val: `%${stats.botSuccessRate}`, icon: Sparkles, color: 'text-purple-600', bg: 'bg-purple-100' },
          { label: t('dashboard.totalMessages'), val: stats.totalMessages, icon: Activity, color: 'text-green-600', bg: 'bg-green-100' },
          { label: t('dashboard.slaRisk'), val: stats.slaBreached, icon: Activity, color: 'text-red-600', bg: 'bg-red-100' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full ${stat.bg} ${stat.color} flex items-center justify-center`}><stat.icon size={24} /></div>
            <div><div className="text-2xl font-bold text-slate-900">{stat.val}</div><div className="text-xs text-slate-500 font-medium uppercase">{stat.label}</div></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { label: t('dashboard.deflection'), val: `%${stats.deflectionRate}`, color: 'text-emerald-700', bg: 'bg-emerald-100' },
          { label: t('dashboard.handoff'), val: `%${stats.handoffRate}`, color: 'text-amber-700', bg: 'bg-amber-100' },
          { label: t('dashboard.firstResponseAvg'), val: stats.avgFirstResponseMs ? `${Math.round(stats.avgFirstResponseMs / 1000)} ${t('dashboard.secondsShort')}` : '-', color: 'text-indigo-700', bg: 'bg-indigo-100' },
          { label: t('dashboard.resolutionAvg'), val: stats.avgResolutionMs ? `${Math.round(stats.avgResolutionMs / 60000)} ${t('dashboard.minutesShort')}` : '-', color: 'text-slate-700', bg: 'bg-slate-100' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full ${stat.bg} ${stat.color} flex items-center justify-center`}><Activity size={24} /></div>
            <div><div className="text-2xl font-bold text-slate-900">{stat.val}</div><div className="text-xs text-slate-500 font-medium uppercase">{stat.label}</div></div>
          </div>
        ))}
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
        <div className="text-xs text-slate-500 font-medium uppercase mb-3">{t('dashboard.handoffReasons')}</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(stats.handoffReasons || {}).map(([key, val]) => (
            <div key={key} className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-slate-800">{val}</div>
              <div className="text-[10px] text-slate-500 uppercase">{reasonLabel(key)}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-xs text-slate-500">{t('dashboard.csatAvg')}: {stats.csatAvg ?? '-'}</div>
        <div className="mt-2 text-xs text-slate-500">
          {t('dashboard.lastEval')}:{' '}
          {stats.evalSummary
            ? `%${stats.evalSummary.accuracy} ${t('dashboard.accuracy')} / %${stats.evalSummary.coverage} ${t('dashboard.coverage')} (${new Date(stats.evalSummary.createdAt).toLocaleString(locale)})`
            : '-'}
        </div>
      </div>
    </div>
  );
}

function SettingsView({ token, t }) {
  const [config, setConfig] = useState({
    apiKey: '',
    apiKeyMasked: '',
    modelName: '',
    systemPrompt: '',
    provider: 'GEMINI',
    minSimilarityThreshold: 0.1,
    topK: 3,
    enableIntentClassifier: true,
    intentConfidenceThreshold: 0.65,
    enableFutureStateMachine: false,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/admin/settings', { headers: { Authorization: `Bearer ${token}` } })
       .then(res => res.data && setConfig(prev => ({ 
          ...prev,
          apiKey: '',
          apiKeyMasked: res.data.api_key_masked || '',
          modelName: res.data.model_name || '',
          systemPrompt: res.data.system_prompt || '',
          provider: res.data.provider || 'GEMINI',
          minSimilarityThreshold: typeof res.data.min_similarity_threshold === 'number' ? res.data.min_similarity_threshold : 0.1,
          topK: Number.isInteger(res.data.top_k) ? res.data.top_k : 3,
          enableIntentClassifier: typeof res.data.enable_intent_classifier === 'boolean' ? res.data.enable_intent_classifier : true,
          intentConfidenceThreshold: typeof res.data.intent_confidence_threshold === 'number' ? res.data.intent_confidence_threshold : 0.65,
          enableFutureStateMachine: typeof res.data.enable_future_state_machine === 'boolean' ? res.data.enable_future_state_machine : false,
       })));
  }, [token]);

  const handleSave = async () => {
    setLoading(true);
    try { 
      const payload = { 
        apiKey: config.apiKey, 
        modelName: config.modelName, 
        systemPrompt: config.systemPrompt, 
        provider: config.provider,
        minSimilarityThreshold: Number(config.minSimilarityThreshold),
        topK: Number(config.topK),
        enableIntentClassifier: config.enableIntentClassifier,
        intentConfidenceThreshold: Number(config.intentConfidenceThreshold),
        enableFutureStateMachine: config.enableFutureStateMachine,
      };
      const res = await api.post('/admin/settings', payload, { headers: { Authorization: `Bearer ${token}` } }); 
      if (res.data?.api_key_masked) {
        setConfig(prev => ({ 
          ...prev, 
          apiKey: '', 
          apiKeyMasked: res.data.api_key_masked,
          minSimilarityThreshold: res.data.min_similarity_threshold ?? prev.minSimilarityThreshold,
          topK: res.data.top_k ?? prev.topK,
          enableIntentClassifier:
            typeof res.data.enable_intent_classifier === 'boolean'
              ? res.data.enable_intent_classifier
              : prev.enableIntentClassifier,
          intentConfidenceThreshold:
            typeof res.data.intent_confidence_threshold === 'number'
              ? res.data.intent_confidence_threshold
              : prev.intentConfidenceThreshold,
          enableFutureStateMachine:
            typeof res.data.enable_future_state_machine === 'boolean'
              ? res.data.enable_future_state_machine
              : prev.enableFutureStateMachine,
        }));
      }
      alert(t('settings.updated'));
    } 
    catch (err) { alert(t('settings.saveError')); } finally { setLoading(false); }
  };

  return (
    <div className="p-8 h-full overflow-y-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Settings/>{t('settings.title')}</h1>
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">{t('settings.provider')}</label>
          <select value={config.provider} onChange={e => setConfig({...config, provider: e.target.value})} className="w-full border p-2 rounded">
            <option value="GEMINI">Google Gemini</option><option value="OPENAI">OpenAI (GPT-4)</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">{t('settings.minSimilarity')}</label>
            <input type="number" step="0.01" min="0" max="1" value={config.minSimilarityThreshold} onChange={e => setConfig({...config, minSimilarityThreshold: e.target.value})} className="w-full border p-2 rounded" placeholder="0.2" />
            <Hint text={t('settings.minSimilarityHint')} />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">{t('settings.topK')}</label>
            <input type="number" min="1" max="10" value={config.topK} onChange={e => setConfig({...config, topK: e.target.value})} className="w-full border p-2 rounded" placeholder="3" />
            <Hint text={t('settings.topKHint')} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">{t('settings.modelName')}</label>
          <input value={config.modelName} onChange={e => setConfig({...config, modelName: e.target.value})} className="w-full border p-2 rounded" placeholder="gemini-2.0-flash" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">{t('settings.intentClassifier')}</label>
            <select
              value={String(config.enableIntentClassifier)}
              onChange={e => setConfig({ ...config, enableIntentClassifier: e.target.value === 'true' })}
              className="w-full border p-2 rounded"
            >
              <option value="true">{t('common.yes')}</option>
              <option value="false">{t('common.no')}</option>
            </select>
            <Hint text={t('settings.intentClassifierHint')} />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">{t('settings.intentThreshold')}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={config.intentConfidenceThreshold}
              onChange={e => setConfig({ ...config, intentConfidenceThreshold: e.target.value })}
              className="w-full border p-2 rounded"
              placeholder="0.65"
            />
            <Hint text={t('settings.intentThresholdHint')} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">{t('settings.futureStateMachine')}</label>
          <select
            value={String(config.enableFutureStateMachine)}
            onChange={e => setConfig({ ...config, enableFutureStateMachine: e.target.value === 'true' })}
            className="w-full border p-2 rounded"
          >
            <option value="false">{t('common.no')}</option>
            <option value="true">{t('common.yes')}</option>
          </select>
          <Hint text={t('settings.futureStateMachineHint')} />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">{t('settings.apiKey')}</label>
          {config.apiKeyMasked && <div className="text-xs text-slate-500 mb-2">{t('settings.maskedLabel')}: {config.apiKeyMasked}</div>}
          <input value={config.apiKey} onChange={e => setConfig({...config, apiKey: e.target.value})} className="w-full border p-2 rounded font-mono text-sm" type="password" placeholder={t('settings.apiKeyPlaceholder')} />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">{t('settings.systemPrompt')}</label>
          <textarea value={config.systemPrompt} onChange={e => setConfig({...config, systemPrompt: e.target.value})} className="w-full border p-2 rounded h-32 text-sm" />
        </div>
        <button onClick={handleSave} disabled={loading} className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">{loading ? t('settings.saving') : t('settings.saveApply')}</button>
      </div>
    </div>
  );
}

function UsersView({ token, t }) {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '', fullName: '', role: 'AGENT', agentLang: 'tr' });
  const languageOptions = [
    { value: 'tr', label: t('common.turkish') },
    { value: 'en', label: t('common.english') },
    { value: 'de', label: t('common.german') },
    { value: 'ru', label: t('common.russian') },
    { value: 'fr', label: t('common.french') },
  ];
  const renderLanguage = (code) => {
    const found = languageOptions.find((option) => option.value === String(code).toLowerCase());
    return found ? found.label : String(code || '').toUpperCase();
  };

  useEffect(() => { fetchUsers(); }, []);
  const fetchUsers = async () => { const res = await api.get('/admin/users', { headers: { Authorization: `Bearer ${token}` } }); setUsers(res.data); };
  const handleDelete = async (id) => { if(!confirm(t('users.deleteConfirm'))) return; await api.delete(`/admin/users/${id}`, { headers: { Authorization: `Bearer ${token}` } }); fetchUsers(); };
  const handleCreate = async (e) => {
    e.preventDefault();
    try { await api.post('/admin/users', formData, { headers: { Authorization: `Bearer ${token}` } }); setShowForm(false); fetchUsers(); } catch (err) { alert(t('common.genericError')); }
  };

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-6"><h1 className="text-2xl font-bold text-slate-800">{t('users.title')}</h1><button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 text-white px-4 py-2 rounded flex gap-2"><Plus size={18}/>{t('users.newUser')}</button></div>
      {showForm && (
        <div className="bg-white p-6 rounded-xl border mb-6">
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <input placeholder={t('users.fullName')} className="border p-2 rounded" required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
            <input placeholder={t('users.email')} type="email" className="border p-2 rounded" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            <input placeholder={t('users.password')} type="password" className="border p-2 rounded" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            <select className="border p-2 rounded" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}><option value="AGENT">{t('users.agent')}</option><option value="SUPER_ADMIN">{t('users.superAdmin')}</option></select>
            <select className="border p-2 rounded" aria-label={t('users.nativeLanguage')} value={formData.agentLang} onChange={e => setFormData({...formData, agentLang: e.target.value})}>
              {languageOptions.map((langOption) => (
                <option key={langOption.value} value={langOption.value}>{langOption.label} ({langOption.value.toUpperCase()})</option>
              ))}
            </select>
            <button type="submit" className="bg-green-600 text-white py-2 rounded col-span-2">{t('users.create')}</button>
          </form>
        </div>
      )}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-left"><thead className="bg-slate-50 border-b"><tr><th className="p-4">{t('users.fullName')}</th><th className="p-4">{t('users.email')}</th><th className="p-4">{t('users.role')}</th><th className="p-4">{t('users.language')}</th><th className="p-4">{t('users.action')}</th></tr></thead><tbody>
            {users.map(u => (<tr key={u.id} className="border-b hover:bg-slate-50"><td className="p-4 font-medium">{u.full_name}</td><td className="p-4 text-slate-500">{u.email}</td><td className="p-4">{u.role}</td><td className="p-4">{renderLanguage(u.agent_lang)}</td><td className="p-4"><button onClick={() => handleDelete(u.id)} className="text-red-500 p-2"><Trash2 size={18}/></button></td></tr>))}
        </tbody></table>
      </div>
    </div>
  );
}

function KnowledgeBaseView({ token, t }) {
  const [docs, setDocs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '' });
  const [bulkFormat, setBulkFormat] = useState('json');
  const [bulkMode, setBulkMode] = useState('AUTO');
  const [bulkText, setBulkText] = useState('');
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  useEffect(() => { fetchDocs(); }, []);
  const fetchDocs = async () => { const res = await api.get('/admin/knowledge-base', { headers: { Authorization: `Bearer ${token}` } }); setDocs(res.data); };
  const handleSave = async (e) => { e.preventDefault(); await api.post('/admin/knowledge-base', form, { headers: { Authorization: `Bearer ${token}` } }); setForm({title:'',content:''}); setShowForm(false); fetchDocs(); };
  const handleDelete = async (id) => { if(!confirm(t('kb.deleteConfirm'))) return; await api.delete(`/admin/knowledge-base/${id}`, { headers: { Authorization: `Bearer ${token}` } }); fetchDocs(); };

  const readFileAsText = (file) => (
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsText(file);
    })
  );

  const getReasonLabel = (reason) => {
    if (reason === 'INVALID_ROW_FIELDS') return t('kb.bulkReasonRowFields');
    if (reason === 'CONTENT_TOO_LARGE') return t('kb.bulkReasonContentTooLarge');
    if (reason === 'IMPORT_FAILED') return t('kb.bulkReasonImportFailed');
    return reason;
  };

  const downloadTemplate = async (format) => {
    try {
      const templateMode = bulkMode === 'AUTO' ? 'FAQ' : bulkMode;
      const response = await api.get(`/admin/knowledge-base/import-template?format=${format}&mode=${templateMode}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: format === 'csv' ? 'text' : 'json'
      });

      const content = format === 'csv' ? response.data : JSON.stringify(response.data, null, 2);
      const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `kb_template.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(t('common.genericError'));
    }
  };

  const handleBulkImport = async () => {
    setBulkResult(null);
    let payload = bulkText.trim();
    if (!payload && bulkFile) {
      payload = await readFileAsText(bulkFile);
    }
    if (!payload) {
      alert(t('kb.bulkImportFailed'));
      return;
    }

    setBulkImporting(true);
    try {
      const response = await api.post('/admin/knowledge-base/bulk-import', {
        format: bulkFormat,
        mode: bulkMode,
        payload
      }, { headers: { Authorization: `Bearer ${token}` } });
      setBulkResult(response.data);
      alert(t('kb.bulkImportSuccess', {
        total: response.data.totalRows,
        imported: response.data.imported,
        failed: response.data.failed
      }));
      await fetchDocs();
    } catch (err) {
      const responseData = err?.response?.data || {};
      if (responseData.failedRows) {
        setBulkResult({
          success: false,
          totalRows: 0,
          imported: 0,
          failed: responseData.failedRows.length,
          failedRows: responseData.failedRows
        });
      }
      alert(responseData.error || t('kb.bulkImportFailed'));
    } finally {
      setBulkImporting(false);
    }
  };

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-6"><h1 className="text-2xl font-bold text-slate-800">{t('kb.title')}</h1><button onClick={() => setShowForm(!showForm)} className="bg-amber-600 text-white px-4 py-2 rounded flex gap-2"><Plus size={20}/>{t('kb.new')}</button></div>
      <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 mb-4">
        <div className="font-semibold mb-2">{t('kb.guideTitle')}</div>
        <ul className="list-disc pl-4 text-sm space-y-1">
          <li>{t('kb.guide1')}</li>
          <li>{t('kb.guide2')}</li>
          <li>{t('kb.guide3')}</li>
          <li>{t('kb.guide4')}</li>
        </ul>
      </div>
      <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl p-4 mb-4">
        <div className="font-semibold mb-2">{t('kb.bulkHelpTitle')}</div>
        <ul className="list-disc pl-4 text-sm space-y-1">
          <li>{t('kb.bulkHelp1')}</li>
          <li>{t('kb.bulkHelp2')}</li>
          <li>{t('kb.bulkHelp3')}</li>
          <li>{t('kb.bulkHelp4')}</li>
        </ul>
      </div>
      <div className="bg-white p-6 rounded-xl border mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{t('kb.bulkTitle')}</h2>
            <p className="text-sm text-slate-500 mt-1">{t('kb.bulkDescription')}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => downloadTemplate('json')} className="bg-slate-100 text-slate-700 px-3 py-2 rounded text-xs">{t('kb.bulkDownloadJsonTemplate')}</button>
            <button onClick={() => downloadTemplate('csv')} className="bg-slate-100 text-slate-700 px-3 py-2 rounded text-xs">{t('kb.bulkDownloadCsvTemplate')}</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">{t('kb.bulkFormat')}</label>
            <select value={bulkFormat} onChange={e => setBulkFormat(e.target.value)} className="w-full border p-2 rounded">
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">{t('kb.bulkMode')}</label>
            <select value={bulkMode} onChange={e => setBulkMode(e.target.value)} className="w-full border p-2 rounded">
              <option value="AUTO">{t('kb.bulkModeAuto')}</option>
              <option value="DOCUMENT">{t('kb.bulkModeDocument')}</option>
              <option value="FAQ">{t('kb.bulkModeFaq')}</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">{t('kb.bulkChooseFile')}</label>
          <input
            type="file"
            accept=".json,.csv,text/csv,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              setBulkFile(file);
              const name = String(file?.name || '').toLowerCase();
              if (name.endsWith('.csv')) setBulkFormat('csv');
              if (name.endsWith('.json')) setBulkFormat('json');
            }}
            className="w-full border p-2 rounded"
          />
          {bulkFile && (
            <div className="text-xs text-slate-500 mt-1">
              {t('kb.bulkFileSelected')}: {bulkFile.name}
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">{t('kb.bulkPasteLabel')}</label>
          <textarea
            value={bulkText}
            onChange={(event) => setBulkText(event.target.value)}
            className="w-full border p-2 rounded h-40 font-mono text-xs"
            placeholder={t('kb.bulkPastePlaceholder')}
          />
        </div>
        <div>
          <button onClick={handleBulkImport} disabled={bulkImporting} className="bg-indigo-600 text-white px-6 py-2 rounded">
            {bulkImporting ? t('kb.bulkImporting') : t('kb.bulkImport')}
          </button>
        </div>
        {bulkResult && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="font-semibold text-slate-800">{t('kb.bulkResultTitle')}</div>
            <div className="text-slate-600 mt-1">
              {t('kb.bulkImportSuccess', {
                total: bulkResult.totalRows ?? 0,
                imported: bulkResult.imported ?? 0,
                failed: bulkResult.failed ?? 0
              })}
            </div>
            {Array.isArray(bulkResult.failedRows) && bulkResult.failedRows.length > 0 && (
              <div className="mt-2 text-xs text-slate-600">
                <div className="font-semibold">{t('kb.bulkFailedRows')}:</div>
                <ul className="list-disc pl-4 mt-1 space-y-1 max-h-36 overflow-y-auto">
                  {bulkResult.failedRows.map((row, idx) => (
                    <li key={`${row.row}-${idx}`}>#{row.row}: {getReasonLabel(row.reason)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
      {showForm && <div className="bg-white p-6 rounded-xl border mb-6"><form onSubmit={handleSave} className="space-y-4"><input className="w-full border p-2 rounded" placeholder={t('kb.docTitle')} value={form.title} onChange={e => setForm({...form, title: e.target.value})} required/><textarea className="w-full border p-2 rounded h-32" placeholder={t('kb.docContent')} value={form.content} onChange={e => setForm({...form, content: e.target.value})} required/><button className="bg-slate-900 text-white px-6 py-2 rounded">{t('common.save')}</button></form></div>}
      <div className="overflow-y-auto bg-white rounded-xl border max-h-[42vh]"><table className="w-full text-left"><thead className="bg-slate-50 border-b"><tr><th className="p-4">{t('kb.docTitle')}</th><th className="p-4">{t('kb.date')}</th><th className="p-4">{t('users.action')}</th></tr></thead><tbody>{docs.map(doc => (<tr key={doc.id} className="hover:bg-slate-50 border-b"><td className="p-4 font-medium">{doc.title}</td><td className="p-4 text-slate-500">{new Date(doc.created_at).toLocaleDateString()}</td><td className="p-4"><button onClick={() => handleDelete(doc.id)} className="text-red-500 p-2"><Trash2 size={18}/></button></td></tr>))}</tbody></table></div>
    </div>
  );
}

function RetrievalDebugView({ token, t }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await api.get(`/admin/retrieval-debug?query=${encodeURIComponent(query.trim())}`, { headers: { Authorization: `Bearer ${token}` } });
      setResult(res.data);
    } catch (err) {
      alert(t('retrieval.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 h-full overflow-y-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">{t('common.retrievalDebug')}</h1>
      <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-xl p-4 mb-4">
        <div className="font-semibold mb-2">{t('retrieval.guideTitle')}</div>
        <ul className="list-disc pl-4 text-sm space-y-1">
          <li>{t('retrieval.guide1')}</li>
          <li>{t('retrieval.guide2')}</li>
          <li>{t('retrieval.guide3')}</li>
          <li>{t('retrieval.guide4')}</li>
        </ul>
      </div>
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex gap-3">
          <input value={query} onChange={e => setQuery(e.target.value)} className="flex-1 border p-2 rounded" placeholder={t('retrieval.queryPlaceholder')} />
          <button onClick={handleSearch} disabled={loading} className="bg-indigo-600 text-white px-4 rounded">{loading ? t('retrieval.searching') : t('retrieval.search')}</button>
        </div>
        {result && (
          <div className="space-y-4">
            <div className="text-xs text-slate-500">
              Config: minSimilarity={result.config.minSimilarity}, topK={result.config.topK}, candidateK={result.config.candidateK}
            </div>
            <div className="space-y-2">
              {result.candidates.map((c, i) => (
                <div key={i} className={`p-3 rounded border ${c.selected ? 'border-emerald-400 bg-emerald-50' : 'border-slate-100 bg-slate-50'}`}>
                  <div className="text-xs text-slate-500 mb-1">sim={c.similarity?.toFixed?.(3)} | key={c.keywordScore?.toFixed?.(3)} | score={c.combinedScore?.toFixed?.(3)}</div>
                  <div className="text-sm text-slate-700">{c.snippet}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Audit Logs View (Admin) ---
function AuditLogsView({ token, t }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/audit-logs?limit=100', { headers: { Authorization: `Bearer ${token}` } });
      setLogs(res.data || []);
    } catch (err) {
      alert(t('audit.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{t('common.auditLogs')}</h1>
        <button onClick={fetchLogs} disabled={loading} className="bg-slate-900 text-white px-4 py-2 rounded">{loading ? t('common.loading') : t('common.refresh')}</button>
      </div>
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-4">{t('audit.date')}</th>
              <th className="p-4">{t('audit.action')}</th>
              <th className="p-4">{t('audit.user')}</th>
              <th className="p-4">{t('audit.target')}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b hover:bg-slate-50">
                <td className="p-4 text-sm text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                <td className="p-4 text-sm font-medium">{log.action}</td>
                <td className="p-4 text-sm">{log.user?.email || '-'}</td>
                <td className="p-4 text-xs text-slate-500">{log.target_type}:{log.target_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Training & Eval View (Admin) ---
function TrainingView({ token, t }) {
  const [examples, setExamples] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [runs, setRuns] = useState([]);
  const [form, setForm] = useState({ question: '', expectedAnswer: '' });
  const [loading, setLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [exRes, qRes, rRes] = await Promise.all([
        api.get('/admin/training-examples?limit=20', { headers: { Authorization: `Bearer ${token}` } }),
        api.get('/admin/eval-questions', { headers: { Authorization: `Bearer ${token}` } }),
        api.get('/admin/eval-runs?limit=5', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setExamples(exRes.data || []);
      setQuestions(qRes.data || []);
      setRuns(rRes.data || []);
    } catch (err) {
      alert(t('training.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleExport = async (format) => {
    try {
      const res = await api.get(`/admin/training-export?format=${format}`, { headers: { Authorization: `Bearer ${token}` }, responseType: format === 'csv' ? 'text' : 'json' });
      const body = format === 'csv' ? res.data : JSON.stringify(res.data, null, 2);
      const blob = new Blob([body], { type: format === 'csv' ? 'text/csv' : 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `training_export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(t('training.exportError'));
    }
  };

  const addQuestion = async (e) => {
    e.preventDefault();
    if (!form.question.trim() || !form.expectedAnswer.trim()) return;
    try {
      await api.post('/admin/eval-questions', { question: form.question, expectedAnswer: form.expectedAnswer }, { headers: { Authorization: `Bearer ${token}` } });
      setForm({ question: '', expectedAnswer: '' });
      fetchAll();
    } catch (err) { alert(t('training.questionAddError')); }
  };

  const deleteQuestion = async (id) => {
    if (!confirm(t('users.deleteConfirm'))) return;
    await api.delete(`/admin/eval-questions/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    fetchAll();
  };

  const runEval = async () => {
    try {
      await api.post('/admin/eval-run', {}, { headers: { Authorization: `Bearer ${token}` } });
      fetchAll();
    } catch (err) {
      alert(t('training.evalRunError'));
    }
  };

  return (
    <div className="p-8 h-full overflow-y-auto space-y-8">
      <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl p-4">
        <div className="font-semibold mb-2">{t('training.guideTitle')}</div>
        <ul className="list-disc pl-4 text-sm space-y-1">
          <li>{t('training.guide1')}</li>
          <li>{t('training.guide2')}</li>
          <li>{t('training.guide3')}</li>
          <li>{t('training.guide4')}</li>
        </ul>
      </div>
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">{t('training.exportTitle')}</h2>
          <div className="flex gap-2">
            <button onClick={() => handleExport('json')} className="bg-slate-900 text-white px-4 py-2 rounded text-sm">{t('training.exportJson')}</button>
            <button onClick={() => handleExport('csv')} className="bg-slate-100 text-slate-700 px-4 py-2 rounded text-sm">{t('training.exportCsv')}</button>
          </div>
        </div>
        <div className="text-xs text-slate-500">{t('training.lastRecords', { count: examples.length })}</div>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">{t('training.evalSet')}</h2>
          <button onClick={runEval} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm">{t('training.evalRun')}</button>
        </div>
        <form onSubmit={addQuestion} className="grid grid-cols-2 gap-4 mb-6">
          <input value={form.question} onChange={e => setForm({ ...form, question: e.target.value })} className="border p-2 rounded" placeholder={t('training.question')} />
          <input value={form.expectedAnswer} onChange={e => setForm({ ...form, expectedAnswer: e.target.value })} className="border p-2 rounded" placeholder={t('training.expectedAnswer')} />
          <button type="submit" className="bg-slate-900 text-white px-4 py-2 rounded col-span-2">{t('training.add')}</button>
        </form>
        <div className="bg-slate-50 border rounded">
          <table className="w-full text-left">
            <thead className="bg-white border-b"><tr><th className="p-3">{t('training.question')}</th><th className="p-3">{t('training.expected')}</th><th className="p-3">{t('users.action')}</th></tr></thead>
            <tbody>
              {questions.map(q => (
                <tr key={q.id} className="border-b">
                  <td className="p-3 text-sm">{q.question}</td>
                  <td className="p-3 text-sm text-slate-500">{q.expected_answer}</td>
                  <td className="p-3"><button onClick={() => deleteQuestion(q.id)} className="text-red-500 text-xs">{t('training.delete')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-4">{t('training.lastEvalRun')}</h2>
        {runs.length === 0 ? (
          <div className="text-sm text-slate-500">{t('training.noEvalRun')}</div>
        ) : (
          <div className="text-sm text-slate-700">
            {runs[0].accuracy}% {t('dashboard.accuracy')}, {runs[0].coverage}% {t('dashboard.coverage')} ({t('training.total')}: {runs[0].total}) - {new Date(runs[0].created_at).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

function LeadTimeline({ items, t }) {
  if (!items || items.length === 0) {
    return <div className="text-xs text-slate-400">{t('leads.noActivity')}</div>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-2">
          <div className="text-[10px] font-semibold text-slate-600">{t(`leads.activity.${String(item.type || '').toLowerCase()}`)}</div>
          <div className="text-[11px] text-slate-500">{new Date(item.createdAt).toLocaleString()}</div>
          {item?.payload?.note && <div className="mt-1 text-xs text-slate-700">{item.payload.note}</div>}
        </div>
      ))}
    </div>
  );
}

function LeadsView({ token, t, onOpenConversation }) {
  const [filters, setFilters] = useState({ status: '', from: '', to: '', search: '' });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const res = await api.get('/agent/leads', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.from ? { from: filters.from } : {}),
          ...(filters.to ? { to: filters.to } : {}),
          ...(filters.search ? { search: filters.search } : {}),
          limit: 300,
        },
      });
      setRows(res.data || []);
    } catch (err) {
      alert(t('leads.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const exportLeads = async (format) => {
    try {
      const res = await api.get(`/agent/leads/export?format=${format}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.from ? { from: filters.from } : {}),
          ...(filters.to ? { to: filters.to } : {}),
          ...(filters.search ? { search: filters.search } : {}),
        },
        responseType: format === 'csv' ? 'text' : 'json',
      });
      const blob = format === 'csv'
        ? new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
        : new Blob([JSON.stringify(res.data.rows || [], null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `leads_export.${format}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      alert(t('leads.exportError'));
    }
  };

  useEffect(() => {
    loadLeads();
  }, [reloadTick]);

  const statusLabel = (status) => {
    const key = `leads.status.${String(status || '').toLowerCase()}`;
    const value = t(key);
    return value === key ? status : value;
  };

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{t('leads.title')}</h1>
        <div className="flex gap-2">
          <button onClick={() => exportLeads('json')} className="px-3 py-2 rounded bg-slate-900 text-white text-xs font-semibold">{t('leads.exportJson')}</button>
          <button onClick={() => exportLeads('csv')} className="px-3 py-2 rounded bg-slate-100 text-slate-700 text-xs font-semibold">{t('leads.exportCsv')}</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-4 mb-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <input
          value={filters.search}
          onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          placeholder={t('leads.searchPlaceholder')}
          className="border rounded px-3 py-2 text-sm"
        />
        <select
          value={filters.status}
          onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="">{t('leads.allStatuses')}</option>
          {LEAD_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>{statusLabel(status)}</option>
          ))}
        </select>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
          className="border rounded px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
          className="border rounded px-3 py-2 text-sm"
        />
        <button
          onClick={() => setReloadTick((tick) => tick + 1)}
          className="rounded bg-indigo-600 text-white text-sm font-semibold px-3 py-2"
        >
          {loading ? t('common.loading') : t('common.refresh')}
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500">
            <tr>
              <th className="p-3">{t('leads.tableVisitor')}</th>
              <th className="p-3">{t('leads.tableContact')}</th>
              <th className="p-3">{t('leads.tableStatus')}</th>
              <th className="p-3">{t('leads.tableSource')}</th>
              <th className="p-3">{t('leads.tableLastContact')}</th>
              <th className="p-3">{t('leads.tableAction')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.conversationId} className="border-b hover:bg-slate-50">
                <td className="p-3 text-sm">
                  <div className="font-semibold text-slate-800">{row.lead?.fullName || row.visitorName || '-'}</div>
                  <div className="text-xs text-slate-500">{row.conversationId.slice(0, 8)}...</div>
                </td>
                <td className="p-3 text-sm">
                  <div>{row.lead?.email || '-'}</div>
                  <div className="text-xs text-slate-500">{row.lead?.phone || '-'}</div>
                </td>
                <td className="p-3 text-sm font-semibold">{statusLabel(row.lead?.status)}</td>
                <td className="p-3 text-sm">{row.lead?.source || '-'}</td>
                <td className="p-3 text-sm">{row.lead?.lastContactAt ? new Date(row.lead.lastContactAt).toLocaleString() : '-'}</td>
                <td className="p-3 text-sm">
                  <button onClick={() => onOpenConversation(row.conversationId)} className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 text-xs font-semibold">
                    {t('leads.openConversation')}
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-sm text-slate-500">{t('leads.empty')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Agent Assist Panel (Aynı) ---
function AgentAssist({
  lastMessage,
  conversationId,
  token,
  onUseSuggestion,
  t,
  leadDraft,
  setLeadDraft,
  leadSaving,
  onSaveLead,
  leadActivities,
  leadActivityLoading,
  onRefreshLeadActivities,
  isAssignedToMe,
  leadStatusLabel,
  leadSourceLabel,
}) {
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(false);

  const getSuggestion = async () => {
    setLoading(true);
    try {
      const res = await api.post('/agent/assist', { text: lastMessage, conversationId }, { headers: { Authorization: `Bearer ${token}` } });
      setSuggestion(res.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  return (
    <div className="w-[360px] bg-white border-l border-slate-200 p-4 hidden xl:flex flex-col h-full overflow-y-auto">
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h4 className="font-bold text-slate-700">{t('leads.cardTitle')}</h4>
            <p className="text-[11px] text-slate-500">{t('leads.cardSubtitle')}</p>
          </div>
          <div className="text-[10px] font-semibold px-2 py-1 rounded bg-indigo-50 text-indigo-700">
            {leadStatusLabel(leadDraft.status)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <select
            value={leadDraft.status}
            onChange={(e) => setLeadDraft((prev) => ({ ...prev, status: e.target.value }))}
            className="border rounded px-2 py-1.5 text-xs"
            disabled={!isAssignedToMe}
          >
            {LEAD_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{leadStatusLabel(status)}</option>
            ))}
          </select>
          <select
            value={leadDraft.source}
            onChange={(e) => setLeadDraft((prev) => ({ ...prev, source: e.target.value }))}
            className="border rounded px-2 py-1.5 text-xs"
            disabled={!isAssignedToMe}
          >
            {LEAD_SOURCE_OPTIONS.map((source) => (
              <option key={source} value={source}>{leadSourceLabel(source)}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <input
            value={leadDraft.fullName}
            onChange={(e) => setLeadDraft((prev) => ({ ...prev, fullName: e.target.value }))}
            placeholder={t('leads.fullName')}
            className="border rounded px-2 py-1.5 text-xs w-full"
            disabled={!isAssignedToMe}
          />
          <input
            value={leadDraft.email}
            onChange={(e) => setLeadDraft((prev) => ({ ...prev, email: e.target.value }))}
            placeholder={t('leads.email')}
            className="border rounded px-2 py-1.5 text-xs w-full"
            disabled={!isAssignedToMe}
          />
          <input
            value={leadDraft.phone}
            onChange={(e) => setLeadDraft((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder={t('leads.phone')}
            className="border rounded px-2 py-1.5 text-xs w-full"
            disabled={!isAssignedToMe}
          />
          <input
            value={leadDraft.externalId}
            onChange={(e) => setLeadDraft((prev) => ({ ...prev, externalId: e.target.value }))}
            placeholder={t('leads.externalId')}
            className="border rounded px-2 py-1.5 text-xs w-full"
            disabled={!isAssignedToMe}
          />
          <textarea
            value={leadDraft.note}
            onChange={(e) => setLeadDraft((prev) => ({ ...prev, note: e.target.value }))}
            placeholder={t('leads.note')}
            className="border rounded px-2 py-1.5 text-xs min-h-16 w-full"
            disabled={!isAssignedToMe}
          />
        </div>
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 max-h-32 overflow-y-auto">
          {leadActivityLoading ? (
            <div className="text-xs text-slate-400">{t('common.loading')}</div>
          ) : (
            <LeadTimeline items={leadActivities} t={t} />
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <button
            onClick={onRefreshLeadActivities}
            className="flex-1 px-2 py-1.5 rounded bg-slate-100 text-slate-700 text-xs font-semibold"
          >
            {t('common.refresh')}
          </button>
          <button
            onClick={onSaveLead}
            disabled={!isAssignedToMe || leadSaving}
            className={`flex-1 px-2 py-1.5 rounded text-xs font-semibold ${!isAssignedToMe || leadSaving ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white'}`}
          >
            {leadSaving ? t('common.loading') : t('leads.save')}
          </button>
        </div>
      </div>

      <div className="mb-4">
        <h4 className="font-bold text-slate-700 flex items-center gap-2 mb-2"><Sparkles size={16} className="text-amber-500"/> {t('inbox.aiAssistant')}</h4>
        {lastMessage ? (
          <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-600 italic border border-slate-100 mb-3">"{lastMessage.substring(0, 80)}..."</div>
        ) : (
          <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-400 border border-slate-100 mb-3">{t('inbox.waitingMessage')}</div>
        )}
        {!suggestion ? (
          <button onClick={getSuggestion} disabled={loading || !lastMessage} className="w-full bg-indigo-50 text-indigo-600 border border-indigo-200 py-2 rounded-lg text-sm font-medium hover:bg-indigo-100 disabled:opacity-50">{loading ? t('inbox.suggestionLoading') : t('inbox.askSuggestion')}</button>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-green-50 border border-green-100 p-3 rounded-lg text-sm text-slate-800 mb-3">{suggestion.suggestion}</div>
            {suggestion.citations && suggestion.citations.length > 0 && <div className="mb-3 space-y-1">{suggestion.citations.map((c, i) => (<div key={i} className="text-[10px] text-slate-500 bg-slate-100 px-2 py-1 rounded flex gap-1 items-center"><Book size={10}/> {c.snippet}</div>))}</div>}
            <button onClick={() => onUseSuggestion(suggestion.suggestion)} className="w-full bg-green-600 text-white py-2 rounded-lg text-sm hover:bg-green-700 mb-2">{t('inbox.useSuggestion')}</button>
            <button onClick={() => setSuggestion(null)} className="w-full text-slate-400 text-xs hover:text-slate-600">{t('inbox.clearSuggestion')}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main Agent Panel ---
export default function AgentPanel() {
  const log = createLogger('agent');
  const { t, lang, setLang } = useI18n();
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [queueTab, setQueueTab] = useState('WAITING');
  const [now, setNow] = useState(Date.now());
  const [csatModalOpen, setCsatModalOpen] = useState(false);
  const [csatScore, setCsatScore] = useState('5');
  const [pendingResolveId, setPendingResolveId] = useState(null);
  const [toast, setToast] = useState(null);
  
  // Chat State
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [leadDraft, setLeadDraft] = useState(createEmptyLeadDraft());
  const [leadActivities, setLeadActivities] = useState([]);
  const [leadSaving, setLeadSaving] = useState(false);
  const [leadActivityLoading, setLeadActivityLoading] = useState(false);
  const [socket, setSocket] = useState(null);
  const messagesEndRef = useRef(null);
  const selectedIdRef = useRef(null);

  const joinSelectedConversationRoom = (sock) => {
    const targetId = selectedIdRef.current;
    if (!sock || !targetId) return;
    sock.emit('join', { conversationId: targetId });
  };

  const persistAuth = (t, u) => {
    localStorage.setItem('auth_token', t);
    localStorage.setItem('auth_user', JSON.stringify(u));
  };

  const clearAuth = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
  };

  const parseJwt = (jwt) => {
    try {
      const payload = jwt.split('.')[1];
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  };

  const handleLogin = (t, u) => {
    setToken(t);
    setUser(u);
    persistAuth(t, u);
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  };

  const upsertConversation = (prev, incoming) => {
    if (!incoming?.conversationId) return prev;
    const normalizedIncoming = {
      ...incoming,
      lead: incoming.lead || (
        incoming.leadStatus || incoming.leadSource || incoming.leadLastContactAt
          ? {
            status: incoming.leadStatus || 'NEW',
            source: incoming.leadSource || 'WIDGET',
            lastContactAt: incoming.leadLastContactAt || null,
          }
          : undefined
      ),
    };
    const idx = prev.findIndex(c => c.conversationId === incoming.conversationId);
    if (idx === -1) return [normalizedIncoming, ...prev];
    const updated = [...prev];
    updated[idx] = { ...updated[idx], ...normalizedIncoming };
    return updated;
  };

  const playNotificationSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.05;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
      osc.onended = () => ctx.close();
    } catch (err) {}
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('auth_user');
    if (savedToken && savedUser) {
      const decoded = parseJwt(savedToken);
      const expMs = decoded?.exp ? decoded.exp * 1000 : null;
      if (expMs && Date.now() > expMs) {
        clearAuth();
        return;
      }
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const loadData = async () => {
    try {
      const res = await api.get('/agent/conversations', { headers: { Authorization: `Bearer ${token}` } });
      setConversations(res.data);
    } catch(e) {
      log.warn('load conversations failed', e?.response?.status || e?.message);
    }
  };

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // --- Realtime Logic ---
  useEffect(() => {
    if (!token) return;
    loadData();
    
    const newSocket = io(SOCKET_URL, { auth: { token } });
    newSocket.on('connect', () => {
      newSocket.emit('join_agent_queue');
      joinSelectedConversationRoom(newSocket);
    });
    
    newSocket.on('conversation:new', (data) => {
        setConversations(prev => upsertConversation(prev, data));
        showToast(t('inbox.toastNewConversation'));
        playNotificationSound();
        loadData();
        log.info('conversation:new', data);
    });
    
    newSocket.on('message:new', (msg) => { 
        if (selectedIdRef.current === msg.conversationId) {
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            const withoutPending = prev.filter(m => !(m.pending && m.senderType === 'AGENT' && (m.textOriginal || '').trim() === (msg.textOriginal || '').trim()));
            return [...withoutPending, msg];
          });
        }
        setConversations(prev => upsertConversation(prev, { conversationId: msg.conversationId, lastMessageAt: msg.createdAt, visitorLeftAt: null }));
    });

    // YENİ: Handoff Durumu Dinleyici
    newSocket.on('conversation:update', (data) => {
        setConversations(prev => upsertConversation(prev, {
          conversationId: data.conversationId,
          botEnabled: data.botEnabled,
          lead: data.lead,
          leadStatus: data.lead?.status,
          leadSource: data.lead?.source,
          leadLastContactAt: data.lead?.lastContactAt,
        }));
        if (selectedIdRef.current === data.conversationId && data.lead) {
          setLeadDraft(prev => ({ ...prev, ...buildLeadDraft(data.lead), note: prev.note }));
        }
        loadData();
    });

    newSocket.on('conversation_assigned', (data) => {
        setConversations(prev => upsertConversation(prev, { conversationId: data.conversationId, assignedAgentId: data.assignedAgentId, status: data.status, needsHandoff: false }));
        loadData();
    });

    newSocket.on('conversation_status_changed', (data) => {
        setConversations(prev => upsertConversation(prev, { conversationId: data.conversationId, status: data.status, assignedAgentId: data.assignedAgentId }));
        loadData();
    });

    newSocket.on('conversation:escalated', (data) => {
        setConversations(prev => upsertConversation(prev, { conversationId: data.conversationId, priority: data.priority || 'HIGH' }));
    });

    newSocket.on('conversation:handoff_needed', (data) => {
        setConversations(prev => upsertConversation(prev, { conversationId: data.conversationId, needsHandoff: true, status: 'WAITING', priority: 'HIGH' }));
        showToast(t('inbox.toastBotNoData'));
        playNotificationSound();
        loadData();
    });

    newSocket.on('conversation:visitor_left', (data) => {
        setConversations(prev => upsertConversation(prev, { conversationId: data.conversationId, visitorLeftAt: data.at }));
        showToast(t('inbox.toastVisitorLeft'));
    });

    newSocket.on('reconnect', () => {
      joinSelectedConversationRoom(newSocket);
      loadData();
    });

    newSocket.on('connect_error', () => {
      showToast(t('inbox.toastSocketIssue'));
      loadData();
    });

    setSocket(newSocket);
    return () => newSocket.disconnect();
  }, [token, t]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => loadData(), 10000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!token || activeTab !== 'inbox') return;
    loadData();
  }, [activeTab, token]);

  // Sohbet Seçimi
  useEffect(() => {
    if (!selectedId) return;
    window.location.hash = selectedId;
    joinSelectedConversationRoom(socket);
    (async () => {
      try {
        const [detailRes, activityRes] = await Promise.all([
          api.get(`/agent/conversations/${selectedId}`, { headers: { Authorization: `Bearer ${token}` } }),
          api.get(`/agent/conversations/${selectedId}/lead-activities?limit=30`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        setMessages(detailRes.data.messages || []);
        setLeadDraft(buildLeadDraft(detailRes.data.lead));
        setLeadActivities(activityRes.data || []);
      } catch (err) {
        setMessages([]);
        setLeadDraft(createEmptyLeadDraft());
        setLeadActivities([]);
      }
    })();
  }, [selectedId, socket, token]);

  useEffect(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  useEffect(() => {
    if (selectedId) return;
    setLeadDraft(createEmptyLeadDraft());
    setLeadActivities([]);
  }, [selectedId]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  const sendMessage = async (textOverride) => {
    const textToSend = typeof textOverride === 'string' ? textOverride : input;
    if (!textToSend.trim() || !selectedId) return;
    if (selectedConv && selectedConv.assignedAgentId && selectedConv.assignedAgentId !== user?.id) return;
    const cleanText = textToSend.trim();
    const optimisticId = `tmp-${Date.now()}`;
    setInput('');
    setMessages(prev => [...prev, {
      id: optimisticId,
      conversationId: selectedId,
      senderType: 'AGENT',
      textOriginal: cleanText,
      textTranslated: cleanText,
      createdAt: new Date().toISOString(),
      pending: true
    }]);
    try { 
      await api.post(`/agent/conversations/${selectedId}/messages`, { textTr: cleanText }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) { 
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      setInput(cleanText);
      console.error(err);
      alert(t('inbox.sendFailed'));
    }
  };

  const assignConversation = async (conversationId) => {
    try {
      await api.post(`/agent/conversations/${conversationId}/assign`, {}, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      alert(t('inbox.assignFailed'));
    }
  };

  const resolveConversation = async () => {
    if (!selectedId) return;
    try {
      await api.post(`/agent/conversations/${selectedId}/resolve`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setPendingResolveId(selectedId);
      setCsatScore('5');
      setCsatModalOpen(true);
    } catch (err) {
      alert(t('inbox.resolveFailed'));
    }
  };

  const submitCsat = async () => {
    if (!pendingResolveId) return;
    const scoreNum = Number(csatScore);
    if ([1, 2, 3, 4, 5].includes(scoreNum)) {
      await api.post(`/agent/conversations/${pendingResolveId}/csat`, { score: scoreNum }, { headers: { Authorization: `Bearer ${token}` } });
    }
    setCsatModalOpen(false);
    setPendingResolveId(null);
  };

  const refreshLeadActivities = async (conversationId) => {
    if (!conversationId) return;
    setLeadActivityLoading(true);
    try {
      const res = await api.get(`/agent/conversations/${conversationId}/lead-activities?limit=30`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLeadActivities(res.data || []);
    } catch (err) {
      setLeadActivities([]);
    } finally {
      setLeadActivityLoading(false);
    }
  };

  const saveLead = async () => {
    if (!selectedId) return;
    setLeadSaving(true);
    try {
      const payload = {
        leadStatus: leadDraft.status,
        leadSource: leadDraft.source,
        userProfile: {
          fullName: leadDraft.fullName,
          email: leadDraft.email,
          phone: leadDraft.phone,
          externalId: leadDraft.externalId,
        },
        note: leadDraft.note,
      };
      const res = await api.post(`/agent/conversations/${selectedId}/lead`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLeadDraft((prev) => ({ ...prev, note: '', ...buildLeadDraft(res.data.lead) }));
      setConversations((prev) => prev.map((conversation) => (
        conversation.conversationId === selectedId
          ? { ...conversation, lead: res.data.lead }
          : conversation
      )));
      await refreshLeadActivities(selectedId);
    } catch (err) {
      alert(t('leads.updateError'));
    } finally {
      setLeadSaving(false);
    }
  };

  // Manuel Handoff (Devral / Bota Ver)
  const toggleHandoff = async (newStatus) => {
    if(!selectedId) return;
    try {
        if (!newStatus) {
          await api.post(`/agent/conversations/${selectedId}/assign`, {}, { headers: { Authorization: `Bearer ${token}` } });
        }
        // newStatus: true = Bot, false = Agent
        await api.post(`/agent/conversations/${selectedId}/handoff`, { botEnabled: newStatus, handoffReason: 'EXPLICIT_HUMAN_REQUEST' }, { headers: { Authorization: `Bearer ${token}` } });
        setConversations(prev => prev.map(c => c.conversationId === selectedId ? {
          ...c,
          botEnabled: newStatus,
          status: newStatus ? c.status : 'ASSIGNED',
          assignedAgentId: newStatus ? c.assignedAgentId : (c.assignedAgentId || user?.id),
          needsHandoff: false
        } : c));
    } catch (err) { console.error(err); }
  };

  const sendFeedback = async (msgId, score) => {
    try {
      let payload = { score };
      if (score === -1) {
        const correctAnswer = prompt(t('inbox.feedbackPrompt'));
        if (correctAnswer && correctAnswer.trim().length > 0) {
          payload.correctAnswer = correctAnswer.trim();
        }
      }
      await api.post(`/agent/messages/${msgId}/feedback`, payload, { headers: { Authorization: `Bearer ${token}` } });
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, feedback: score } : m));
    } catch (err) {}
  };

  if (!token) return <LoginScreen onLogin={handleLogin} t={t} />;

  const lastVisitorMsg = messages.slice().reverse().find(m => m.senderType === 'VISITOR');
  const selectedConv = conversations.find(c => c.conversationId === selectedId);
  const isBotActive = selectedConv?.botEnabled !== false; // Varsayılan True
  const isAssignedToMe = selectedConv?.assignedAgentId ? selectedConv?.assignedAgentId === user?.id : true;
  const SLA_WARN_SECONDS = Number(import.meta.env.VITE_SLA_WARN_SECONDS || 60);
  const filteredConversations = conversations.filter(c => {
    if (queueTab === 'WAITING') {
      if (c.status === 'WAITING') return true;
      if (c.status === 'ASSIGNED' && c.assignedAgentId && c.assignedAgentId !== user?.id) return true;
      return false;
    }
    if (queueTab === 'ASSIGNED') return c.status === 'ASSIGNED' && c.assignedAgentId === user?.id;
    if (queueTab === 'RESOLVED') return c.status === 'RESOLVED';
    return true;
  });
  const leadStatusLabel = (status) => {
    const key = `leads.status.${String(status || '').toLowerCase()}`;
    const value = t(key);
    return value === key ? status : value;
  };
  const leadSourceLabel = (source) => {
    const key = `leads.source.${String(source || '').toLowerCase()}`;
    const value = t(key);
    return value === key ? source : value;
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden relative">
      {toast && (
        <div className="absolute top-4 right-4 bg-slate-900 text-white text-sm px-4 py-2 rounded shadow-lg z-50">
          {toast}
        </div>
      )}
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 min-h-0">
        <div className="px-6 pt-6 pb-4 text-white text-xl tracking-wide font-medium">{t('common.brand')}</div>
        <div className="px-6 mb-4 text-xs">
          <div className="text-slate-500 uppercase">{t('common.loggedInAs')}</div>
          <div className="text-white font-medium">{user.fullName}</div>
          <div className="text-amber-500">{user.role}</div>
        </div>
        <div className="px-6 mb-3">
          <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">{t('common.language')}</div>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="w-full bg-slate-800 text-white border border-slate-700 rounded px-2 py-1.5 text-xs"
          >
            <option value="tr">{t('common.turkish')}</option>
            <option value="en">{t('common.english')}</option>
            <option value="de">{t('common.german')}</option>
            <option value="ru">{t('common.russian')}</option>
            <option value="fr">{t('common.french')}</option>
          </select>
        </div>
        <div className="px-6 mb-4">
          <button onClick={clearAuth} className="w-full flex items-center justify-center gap-2 bg-slate-800 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700 rounded-lg py-2 text-sm">
            <LogOut size={16}/> {t('common.logout')}
          </button>
        </div>
        <nav className="flex-1 min-h-0 overflow-y-auto px-4 space-y-2 text-sm tracking-wide pb-4">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium ${activeTab==='dashboard' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><LayoutDashboard size={18} /> {t('common.dashboard')}</button>
          <button onClick={() => setActiveTab('inbox')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium ${activeTab==='inbox' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><MessageSquare size={18} /> {t('common.inbox')}</button>
          <button onClick={() => setActiveTab('leads')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium ${activeTab==='leads' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><User size={18} /> {t('common.leads')}</button>
          {user.role === 'SUPER_ADMIN' && (
            <>
              <div className="pt-4 pb-2 px-4 text-xs font-bold text-slate-500 uppercase">{t('common.management')}</div>
              <button onClick={() => setActiveTab('kb')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium ${activeTab==='kb' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><BookOpen size={18} /> {t('common.knowledgeBase')}</button>
              <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium ${activeTab==='users' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><Users size={18} /> {t('common.users')}</button>
              <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium ${activeTab==='settings' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><Settings size={18} /> {t('common.settings')}</button>
              <button onClick={() => setActiveTab('retrieval')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium ${activeTab==='retrieval' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><Book size={18} /> {t('common.retrievalDebug')}</button>
              <button onClick={() => setActiveTab('audit')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium ${activeTab==='audit' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><Activity size={18} /> {t('common.auditLogs')}</button>
              <button onClick={() => setActiveTab('training')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium ${activeTab==='training' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><BookOpen size={18} /> {t('common.training')}</button>
            </>
          )}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {activeTab === 'dashboard' && <DashboardView token={token} t={t} lang={lang} />}
        {activeTab === 'leads' && (
          <LeadsView
            token={token}
            t={t}
            onOpenConversation={(conversationId) => {
              setActiveTab('inbox');
              setSelectedId(conversationId);
            }}
          />
        )}
        {activeTab === 'kb' && <KnowledgeBaseView token={token} t={t} />}
        {activeTab === 'users' && <UsersView token={token} t={t} />}
        {activeTab === 'settings' && <SettingsView token={token} t={t} />}
        {activeTab === 'retrieval' && <RetrievalDebugView token={token} t={t} />}
        {activeTab === 'audit' && <AuditLogsView token={token} t={t} />}
        {activeTab === 'training' && <TrainingView token={token} t={t} />}
        
        {activeTab === 'inbox' && (
           <div className="flex h-full">
             {/* Inbox List */}
             <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
               <div className="p-4 border-b font-bold text-slate-700">{t('inbox.queueTitle')}</div>
               <div className="px-3 py-2 border-b flex gap-2">
                 {[
                   { key: 'WAITING', label: t('inbox.waiting') },
                   { key: 'ASSIGNED', label: t('inbox.assigned') },
                   { key: 'RESOLVED', label: t('inbox.resolved') },
                 ].map(tab => (
                   <button
                     key={tab.key}
                     onClick={() => setQueueTab(tab.key)}
                     className={`flex-1 text-xs font-bold py-2 rounded ${queueTab === tab.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                   >
                     {tab.label}
                   </button>
                 ))}
               </div>
               <div className="flex-1 overflow-y-auto">
                 {filteredConversations.map(c => {
                   const baseTime = c.lastMessageAt || c.createdAt;
                   const waitSeconds = baseTime ? Math.floor((now - new Date(baseTime).getTime()) / 1000) : 0;
                   const waitLabel = `${Math.floor(waitSeconds / 60)}:${String(waitSeconds % 60).padStart(2, '0')}`;
                   const slaBreached = c.status === 'WAITING' && waitSeconds >= SLA_WARN_SECONDS;
                   const isTaken = c.assignedAgentId && c.assignedAgentId !== user?.id;
                   return (
                   <div key={c.conversationId} onClick={() => setSelectedId(c.conversationId)} className={`p-4 border-b cursor-pointer hover:bg-slate-50 ${selectedId === c.conversationId ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''}`}>
                     <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-sm text-slate-800">{c.visitorName || t('inbox.visitor')}</span>
                        {/* Handoff Icon */}
                        {c.botEnabled !== false ? (
                            <span title={t('inbox.botRunning')} className="bg-purple-100 text-purple-600 p-1 rounded-full"><Bot size={14}/></span>
                        ) : (
                            <span title={t('inbox.agentRunning')} className="bg-green-100 text-green-600 p-1 rounded-full"><UserCheck size={14}/></span>
                        )}
                     </div>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase">{c.visitorLang || 'EN'}</span>
                       <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase">Widget</span>
                       <span className={`text-xs ${slaBreached ? 'text-red-600 font-bold' : 'text-slate-500'} truncate`}>{waitLabel}</span>
                       {c.priority === 'HIGH' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600 uppercase">{t('inbox.high')}</span>}
                       {c.needsHandoff && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase">{t('inbox.agentNeeded')}</span>}
                       {c.visitorLeftAt && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 uppercase">{t('inbox.visitorLeft')}</span>}
                    </div>
                     <div className="mt-2 flex items-center justify-between">
                       <div className="text-[10px] text-slate-400 uppercase">{c.status}</div>
                       {queueTab === 'WAITING' && !isTaken && (
                         <button onClick={(e) => { e.stopPropagation(); assignConversation(c.conversationId); }} className="text-[10px] font-bold px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700">{t('inbox.claim')}</button>
                       )}
                       {isTaken && <div className="text-[10px] text-amber-600 font-bold">{t('inbox.takenByAnother')}</div>}
                     </div>
                   </div>
                 )})}
               </div>
             </div>
             
             {/* Chat Area */}
             <div className="flex-1 flex flex-col relative bg-slate-50/50">
               {csatModalOpen && (
                 <div className="absolute inset-0 bg-black/30 z-20 flex items-center justify-center">
                   <div className="bg-white rounded-xl p-6 shadow-xl w-80">
                     <div className="text-lg font-bold mb-2">{t('inbox.csatTitle')}</div>
                     <select value={csatScore} onChange={e => setCsatScore(e.target.value)} className="w-full border p-2 rounded mb-4">
                       {[1,2,3,4,5].map(v => <option key={v} value={String(v)}>{v}</option>)}
                     </select>
                     <div className="flex gap-2 justify-end">
                       <button onClick={() => { setCsatModalOpen(false); setPendingResolveId(null); }} className="px-3 py-2 rounded bg-slate-100 text-slate-600">{t('inbox.skip')}</button>
                       <button onClick={submitCsat} className="px-3 py-2 rounded bg-indigo-600 text-white">{t('inbox.save')}</button>
                     </div>
                   </div>
                 </div>
               )}
               {selectedId ? (
                 <>
                   {/* HANDOFF STATUS BAR (HEADER) */}
                   <div className={`h-14 px-6 flex items-center justify-between shrink-0 shadow-sm z-10 transition-colors ${isBotActive ? 'bg-purple-600 text-white' : 'bg-white border-b text-slate-800'}`}>
                      <div className="flex items-center gap-3">
                         <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isBotActive ? 'bg-white/20' : 'bg-green-100 text-green-600'}`}>
                            {isBotActive ? <Bot size={18}/> : <UserCheck size={18}/>}
                         </div>
                         <div>
                            <div className="font-bold text-sm">{selectedConv?.visitorName}</div>
                            <div className={`text-[10px] font-medium flex items-center gap-1 ${isBotActive ? 'text-purple-200' : 'text-green-600'}`}>
                               {isBotActive ? t('inbox.botActive') : t('inbox.liveActive')}
                            </div>
                         </div>
                      </div>
                      
                      {/* ACTION BUTTONS */}
                      <div className="flex items-center gap-2">
                        {isBotActive ? (
                            <button
                              onClick={() => toggleHandoff(false)}
                              disabled={!isAssignedToMe}
                              className={`px-4 py-1.5 rounded-full text-xs font-bold transition shadow-lg flex items-center gap-2 ${isAssignedToMe ? 'bg-white text-purple-700 hover:bg-purple-50' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                            >
                               <Power size={14}/> {t('inbox.takeOver')}
                            </button>
                        ) : (
                            <button
                              onClick={() => toggleHandoff(true)}
                              disabled={!isAssignedToMe}
                              className={`px-4 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-2 ${isAssignedToMe ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                            >
                               <RefreshCw size={14}/> {t('inbox.handToBot')}
                            </button>
                        )}
                        <button
                          onClick={resolveConversation}
                          disabled={!isAssignedToMe}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-2 ${isAssignedToMe ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                        >
                          {t('inbox.resolvedAction')}
                        </button>
                      </div>
                   </div>

                   {/* MESSAGES */}
                   <div className="flex-1 overflow-y-auto p-6 space-y-4">
                     {messages.map((m, i) => {
                       const isBot = m.senderType === 'BOT';
                       const isAgent = m.senderType === 'AGENT' || isBot;
                       
                       return (
                         <div key={i} className={`flex ${isAgent ? 'justify-end' : 'justify-start'} group`}>
                           <div className={`max-w-xl p-4 rounded-2xl shadow-sm text-sm ${isBot ? 'bg-purple-600 text-white' : m.senderType === 'AGENT' ? 'bg-indigo-600 text-white' : 'bg-white border text-slate-800'}`}>
                             <div className="mb-1">{isAgent ? m.textOriginal : (m.textTranslated || m.textOriginal)}</div>
                             
                             {/* Translations & Lang Info */}
                             <div className={`mt-2 pt-2 border-t text-xs flex items-center gap-1.5 ${isAgent ? 'border-white/20 text-indigo-100' : 'border-slate-100 text-slate-400'}`}>
                               <Globe size={12} />
                               {isAgent 
                                 ? <span>{t('inbox.translatedTo')} {(m.targetLang || t('inbox.visitor')).toUpperCase()}: <span className="italic opacity-80">{m.textTranslated}</span></span>
                                 : <span>{t('inbox.original')} ({(m.sourceLang || 'TR').toUpperCase()}): <span className="italic opacity-80">{m.textOriginal}</span></span>
                               }
                             </div>

                             {m.textMasked && (
                               <div className={`mt-2 pt-2 border-t text-xs ${isAgent ? 'border-white/20 text-indigo-100' : 'border-slate-100 text-slate-400'}`}>
                                 {t('inbox.masked')}: <span className="italic opacity-80">{m.textMasked}</span>
                               </div>
                             )}

                             {/* Citations */}
                             {m.citations && m.citations.length > 0 && (
                               <div className="mt-2 pt-2 border-t border-white/20 text-xs opacity-90">
                                 <div className="font-bold mb-1 flex items-center gap-1"><Book size={12}/> {t('inbox.citations')}:</div>
                                 <ul className="list-disc pl-4 space-y-1">{m.citations.map((c, idx) => <li key={idx} className="truncate">{c.snippet || t('kb.document')}</li>)}</ul>
                                </div>
                             )}
                             {/* Feedback */}
                             {isBot && (
                               <div className="flex justify-end gap-2 mt-2 pt-1 border-t border-white/10">
                                  <button onClick={() => sendFeedback(m.id, 1)} className={`p-1 rounded hover:bg-white/20 ${m.feedback === 1 ? 'bg-white/30' : ''}`}><ThumbsUp size={14}/></button>
                                  <button onClick={() => sendFeedback(m.id, -1)} className={`p-1 rounded hover:bg-white/20 ${m.feedback === -1 ? 'bg-white/30' : ''}`}><ThumbsDown size={14}/></button>
                               </div>
                             )}
                           </div>
                         </div>
                       );
                     })}
                     <div ref={messagesEndRef} />
                   </div>

                   {/* INPUT AREA */}
                   <div className={`p-4 bg-white border-t flex gap-2 transition-colors ${!isBotActive ? 'bg-green-50/50' : ''}`}>
                     <input 
                       className="flex-1 border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 ring-indigo-500 transition disabled:opacity-50 disabled:bg-slate-100" 
                       placeholder={!isAssignedToMe ? t('inbox.assignedElsewhere') : (isBotActive ? t('inbox.takeOverPlaceholder') : t('inbox.replyPlaceholder'))} 
                       value={input} 
                       onChange={e => setInput(e.target.value)} 
                       onKeyDown={e => e.key === 'Enter' && sendMessage()}
                       disabled={!isAssignedToMe}
                     />
                     <button onClick={() => sendMessage()} disabled={!isAssignedToMe} className={`px-6 rounded-xl transition ${isAssignedToMe ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}><Send size={20}/></button>
                   </div>
                 </>
               ) : <div className="m-auto text-slate-400 flex flex-col items-center gap-2"><MessageSquare size={48} className="opacity-20"/><span>{t('inbox.noSelection')}</span></div>}
             </div>

             {/* Agent Assist Panel (Right Side) */}
             {selectedId && (
               <AgentAssist
                 lastMessage={lastVisitorMsg?.textOriginal}
                 conversationId={selectedId}
                 token={token}
                 onUseSuggestion={sendMessage}
                 t={t}
                 leadDraft={leadDraft}
                 setLeadDraft={setLeadDraft}
                 leadSaving={leadSaving}
                 onSaveLead={saveLead}
                 leadActivities={leadActivities}
                 leadActivityLoading={leadActivityLoading}
                 onRefreshLeadActivities={() => refreshLeadActivities(selectedId)}
                 isAssignedToMe={isAssignedToMe}
                 leadStatusLabel={leadStatusLabel}
                 leadSourceLabel={leadSourceLabel}
               />
             )}
           </div>
        )}
      </div>
    </div>
  );
}
