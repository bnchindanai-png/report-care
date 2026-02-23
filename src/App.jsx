import React, { useState, useEffect } from 'react';

const SUPABASE_URL = 'https://ikfioqvjrhquiyeylmsv.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZmlvcXZqcmhxdWl5ZXlsbXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4MzQ3MTcsImV4cCI6MjA2NjQxMDcxN30.m0RHqLl6RmM5rTN-TU3YrcvHNpSB9FnH_XN_Y3uhhRc';
const API_BASE = `${SUPABASE_URL}/functions/v1`;
const REST_BASE = `${SUPABASE_URL}/rest/v1`;
const UPLOAD_URL = `${API_BASE}/upload-report-image`;
const MAX_IMAGES = 100;

const BLUE       = '#2196F3';
const DARK_BLUE  = '#1976D2';
const LIGHT_BLUE = '#E3F2FD';

const DEFAULT_CATEGORIES = [
  'รายงานหน้าที่',
  'ข่าวสาร',
  'กิจกรรม',
  'ประชุม',
  'อบรม/สัมมนา',
  'เยี่ยมบ้าน',
  'อื่นๆ',
];

/* ─── field mapping helpers ─── */
const buildTags = (form) => {
  const tags = [];
  if (form.reportDate) tags.push(`report_date:${form.reportDate}`);
  if (form.dutyTime)   tags.push(`duty_time:${form.dutyTime}`);
  if (Array.isArray(form.tags)) form.tags.forEach(t => tags.push(t));
  return tags;
};

const buildDescription = (form) => {
  const parts = [];
  if (form.eventDetail) parts.push(form.eventDetail);
  if (form.note)        parts.push(`หมายเหตุ: ${form.note}`);
  return parts.length > 0 ? parts.join('\n') : (form.activity || '-');
};

/* ════════════════════════════════════════════ */

function App() {
  /* ── Auth state ── */
  const [authToken,   setAuthToken]   = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loginStep,   setLoginStep]   = useState('phone'); // 'phone' | 'otp'
  const [phone,       setPhone]       = useState('');
  const [otp,         setOtp]         = useState('');
  const [otpLoading,  setOtpLoading]  = useState(false);
  const [userName,    setUserName]    = useState('');

  /* ── Form state ── */
  const emptyForm = {
    reportDate: '', dutyTime: '', staffName: '', position: '',
    location: '', activity: '', eventDetail: '', note: '',
    category: 'รายงานหน้าที่', tags: [], tagInput: '', categoryInput: '',
    images: [],
  };
  const [formData,   setFormData]   = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  /* ── Shared categories & tags (DB) ── */
  const [dbCategories, setDbCategories] = useState([]);
  const [dbTags, setDbTags] = useState([]);
  const [showCatDropdown, setShowCatDropdown] = useState(false);

  /* ── Init: check localStorage ── */
  useEffect(() => {
    const token   = localStorage.getItem('ext_token');
    const profile = localStorage.getItem('ext_profile');
    if (token && profile) {
      try {
        const p = JSON.parse(profile);
        setAuthToken(token);
        setUserProfile(p);
        const today = getCurrentDate();
        setFormData(prev => ({
          ...prev,
          reportDate: today,
          staffName: p.name || '',
          position: p.position || '',
        }));
      } catch { /* invalid profile, stay on login */ }
    }
    // Load shared categories & tags from DB
    fetchCategories();
    fetchTags();
  }, []);

  /* ── helpers: fetch & persist categories & tags via REST API ── */
  const restHeaders = { 'apikey': ANON_KEY, 'Content-Type': 'application/json' };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${REST_BASE}/shared_categories?select=name&order=id`, { headers: restHeaders });
      if (res.ok) {
        const data = await res.json();
        setDbCategories(data.map(r => r.name));
      }
    } catch {}
  };

  const fetchTags = async () => {
    try {
      const res = await fetch(`${REST_BASE}/shared_tags?select=name&order=id`, { headers: restHeaders });
      if (res.ok) {
        const data = await res.json();
        setDbTags(data.map(r => r.name));
      }
    } catch {}
  };

  const allCategories = [...new Set([...DEFAULT_CATEGORIES, ...dbCategories])];

  const saveCategory = async (cat) => {
    if (!cat) return;
    try {
      await fetch(`${REST_BASE}/shared_categories?on_conflict=name`, {
        method: 'POST',
        headers: { ...restHeaders, 'Prefer': 'resolution=ignore-duplicates' },
        body: JSON.stringify({ name: cat }),
      });
      if (!dbCategories.includes(cat)) setDbCategories(prev => [...prev, cat]);
    } catch {}
  };

  const saveTag = async (tag) => {
    if (!tag) return;
    try {
      await fetch(`${REST_BASE}/shared_tags?on_conflict=name`, {
        method: 'POST',
        headers: { ...restHeaders, 'Prefer': 'resolution=ignore-duplicates' },
        body: JSON.stringify({ name: tag }),
      });
      if (!dbTags.includes(tag)) setDbTags(prev => [...prev, tag]);
    } catch {}
  };

  const allSavedTags = [...new Set([...dbTags])];

  /* ─── helpers ─── */
  const getCurrentDate = () => new Date().toISOString().split('T')[0];

  const showNotif = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  /* ─── API helper ─── */
  const apiCall = async (endpoint, body, token = null) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST', headers, body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw { status: res.status, ...data };
    return data;
  };

  /* ═══════════════════════════════════════════
     LOGIN FLOW
     ═══════════════════════════════════════════ */

  const handleRequestOtp = async () => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 9) {
      showNotif('กรุณาใส่เบอร์โทรให้ถูกต้อง', 'error');
      return;
    }
    setOtpLoading(true);
    try {
      const data = await apiCall('/external-request-otp', { phone: cleaned });
      if (data.success) {
        setUserName(data.name || '');
        setLoginStep('otp');
        showNotif('ส่ง OTP ไปทาง Telegram แล้ว', 'success');
      }
    } catch (e) {
      const msg = e.error === 'user_not_found' ? 'ไม่พบเบอร์นี้ในระบบ'
                : e.error === 'no_telegram'     ? 'ยังไม่ได้เชื่อมต่อ Telegram'
                : e.error === 'rate_limit'      ? 'ส่ง OTP บ่อยเกินไป กรุณารอ 5 นาที'
                : 'เกิดข้อผิดพลาด กรุณาลองใหม่';
      showNotif(msg, 'error');
    }
    finally { setOtpLoading(false); }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 4) {
      showNotif('กรุณาใส่รหัส OTP', 'error');
      return;
    }
    setOtpLoading(true);
    try {
      const data = await apiCall('/external-verify-otp', {
        phone: phone.replace(/\D/g, ''),
        otp,
        device_name: navigator.userAgent.substring(0, 50),
      });
      if (data.success && data.token) {
        localStorage.setItem('ext_token', data.token);
        localStorage.setItem('ext_profile', JSON.stringify(data.profile));
        setAuthToken(data.token);
        setUserProfile(data.profile);
        const today = getCurrentDate();
        setFormData(prev => ({
          ...prev,
          reportDate: today,
          staffName: data.profile.name || '',
          position: data.profile.position || '',
        }));
        showNotif('เข้าสู่ระบบสำเร็จ', 'success');
      }
    } catch (e) {
      const msg = e.error === 'invalid_otp' ? 'รหัส OTP ไม่ถูกต้อง'
                : e.error === 'otp_expired'  ? 'รหัส OTP หมดอายุ กรุณาขอใหม่'
                : 'เกิดข้อผิดพลาด กรุณาลองใหม่';
      showNotif(msg, 'error');
    }
    finally { setOtpLoading(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem('ext_token');
    localStorage.removeItem('ext_profile');
    setAuthToken(null);
    setUserProfile(null);
    setLoginStep('phone');
    setPhone('');
    setOtp('');
    setUserName('');
    setFormData(emptyForm);
  };

  /* ═══════════════════════════════════════════
     IMAGE UPLOAD
     ═══════════════════════════════════════════ */

  const uploadImage = async (file) => {
    const ext  = file.name.split('.').pop();
    const name = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
    const res = await fetch(UPLOAD_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': file.type || 'image/jpeg',
        'x-file-name': name,
      },
      body: file,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data.url;
  };

  const uploadAllImages = async (images) => {
    const urls = [];
    for (const img of images) {
      if (img.file)             urls.push(await uploadImage(img.file));
      else if (img.existingUrl) urls.push(img.existingUrl);
    }
    return urls;
  };

  const addImageToForm = (file) => {
    setFormData(p => {
      if (p.images.length >= MAX_IMAGES) return p;
      return { ...p, images: [...p.images, { file, preview: URL.createObjectURL(file), existingUrl: null }] };
    });
  };

  const removeImageFromForm = (idx) => {
    setFormData(p => ({ ...p, images: p.images.filter((_, i) => i !== idx) }));
  };

  /* ═══════════════════════════════════════════
     CREATE POST
     ═══════════════════════════════════════════ */

  const handleSubmit = async () => {
    if (!formData.reportDate || !formData.dutyTime || !formData.position ||
        !formData.location || !formData.activity || formData.images.length === 0) {
      showNotif('กรุณากรอกข้อมูลที่จำเป็นให้ครบ (วันที่, เวลา, ตำแหน่ง, สถานที่, กิจกรรม, รูปถ่าย)', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const images = await uploadAllImages(formData.images);
      await apiCall('/create-feed-post', {
        title: formData.activity,
        description: buildDescription(formData),
        category: formData.category || 'รายงานหน้าที่',
        tags: buildTags(formData),
        images,
        location: formData.location ? { name: formData.location } : null,
      }, authToken);

      // Save custom category & tags for future use
      saveCategory(formData.category);
      formData.tags.forEach(t => saveTag(t));

      showNotif('บันทึกรายงานสำเร็จ', 'success');
      setFormData(prev => ({
        ...emptyForm,
        reportDate: getCurrentDate(),
        staffName: prev.staffName,
        position: prev.position,
      }));
    } catch (e) {
      if (e.status === 401 && e.error === 'invalid_token') {
        showNotif('Token หมดอายุ กรุณาเข้าสู่ระบบใหม่', 'error');
        handleLogout();
        return;
      }
      showNotif('เกิดข้อผิดพลาดในการบันทึก: ' + (e.message || ''), 'error');
    }
    finally { setSubmitting(false); }
  };

  /* ═══════════════════════════════════════════
     STYLES
     ═══════════════════════════════════════════ */

  const labelStyle = { display: 'block', fontWeight: 600, color: DARK_BLUE, marginBottom: 8, fontSize: 15 };

  /* ═══════════════════════════════════════════
     RENDER: LOGIN SCREEN
     ═══════════════════════════════════════════ */

  if (!authToken) {
    return (
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '40px 16px', minHeight: '100vh' }}>
        {/* Toast */}
        {toast.show && (
          <div className="toast-slide" style={{
            position: 'fixed', top: 20, right: 20, zIndex: 1000, minWidth: 280,
            background: 'white', padding: '16px 20px', borderRadius: 10,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            borderLeft: `5px solid ${toast.type === 'success' ? '#4CAF50' : '#f44336'}`,
          }}>
            {toast.message}
          </div>
        )}

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%', margin: '0 auto 20px',
            background: `linear-gradient(135deg, ${BLUE} 0%, ${DARK_BLUE} 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(33,150,243,0.3)',
          }}>
            <span style={{ fontSize: 36, color: 'white' }}>📋</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: DARK_BLUE, margin: '0 0 8px' }}>
            ระบบรายงานการปฏิบัติหน้าที่
          </h1>
          <p style={{ fontSize: 15, color: '#666', margin: 0 }}>
            ศูนย์การศึกษาพิเศษ เขตการศึกษา 6 จังหวัดลพบุรี
          </p>
        </div>

        {/* Login Card */}
        <div style={{
          background: 'white', padding: 30, borderRadius: 15,
          boxShadow: '0 2px 20px rgba(0,0,0,0.08)',
        }}>
          {loginStep === 'phone' ? (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: '#333', marginBottom: 20, textAlign: 'center' }}>
                เข้าสู่ระบบ
              </h2>
              <label style={labelStyle}>เบอร์โทรศัพท์</label>
              <input
                type="tel"
                className="input-field"
                value={phone}
                placeholder="0912345678"
                maxLength={10}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRequestOtp()}
                autoFocus
              />
              <p style={{ fontSize: 13, color: '#999', margin: '8px 0 20px' }}>
                ระบบจะส่งรหัส OTP ไปทาง Telegram ของคุณ
              </p>
              <button
                className="save-btn"
                onClick={handleRequestOtp}
                disabled={otpLoading}
                style={{ marginTop: 0 }}
              >
                {otpLoading ? 'กำลังส่ง OTP...' : 'ขอรหัส OTP'}
              </button>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: '#333', marginBottom: 8, textAlign: 'center' }}>
                ยืนยันตัวตน
              </h2>
              {userName && (
                <p style={{ textAlign: 'center', color: DARK_BLUE, fontWeight: 600, fontSize: 16, margin: '0 0 20px' }}>
                  สวัสดี, {userName}
                </p>
              )}
              <p style={{ textAlign: 'center', color: '#666', fontSize: 14, margin: '0 0 20px' }}>
                กรอกรหัส OTP ที่ส่งไปทาง Telegram
              </p>
              <label style={labelStyle}>รหัส OTP</label>
              <input
                type="text"
                className="input-field"
                value={otp}
                placeholder="กรอกรหัส 6 หลัก"
                maxLength={6}
                style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: 700 }}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
                autoFocus
              />
              <button
                className="save-btn"
                onClick={handleVerifyOtp}
                disabled={otpLoading}
              >
                {otpLoading ? 'กำลังตรวจสอบ...' : 'ยืนยัน OTP'}
              </button>
              <button
                onClick={() => { setLoginStep('phone'); setOtp(''); }}
                style={{
                  width: '100%', marginTop: 12, padding: 12, background: 'none',
                  border: `2px solid ${LIGHT_BLUE}`, borderRadius: 10, color: DARK_BLUE,
                  fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sarabun, sans-serif',
                }}
              >
                เปลี่ยนเบอร์โทร
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     RENDER: MAIN (CREATE POST)
     ═══════════════════════════════════════════ */

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px' }}>
      {/* Toast */}
      {toast.show && (
        <div className="toast-slide" style={{
          position: 'fixed', top: 20, right: 20, zIndex: 1000, minWidth: 280,
          background: 'white', padding: '16px 20px', borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          borderLeft: `5px solid ${toast.type === 'success' ? '#4CAF50' : '#f44336'}`,
        }}>
          {toast.message}
        </div>
      )}

      {/* Header + User Info */}
      <div style={{
        background: `linear-gradient(135deg, ${BLUE} 0%, ${DARK_BLUE} 100%)`,
        color: 'white', padding: '24px 25px', borderRadius: 15, marginBottom: 25,
        boxShadow: '0 4px 15px rgba(33,150,243,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>สร้างรายงานใหม่</h1>
            <p style={{ fontSize: 14, opacity: 0.9, margin: '4px 0 0' }}>ศูนย์การศึกษาพิเศษ เขตการศึกษา 6</p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'Sarabun, sans-serif', whiteSpace: 'nowrap',
            }}
          >
            ออกจากระบบ
          </button>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.15)', padding: '12px 16px', borderRadius: 10,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          {userProfile?.avatar_url ? (
            <img src={userProfile.avatar_url} alt=""
              style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{
              width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>
              👤
            </div>
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{userProfile?.name || '-'}</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>{userProfile?.position || '-'}</div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div style={{ background: 'white', padding: 25, borderRadius: 15, boxShadow: '0 2px 15px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'grid', gap: 18 }}>

          {/* Row: Date + Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>วันที่ <span style={{ color: '#f44336', fontSize: 14 }}>*</span></label>
              <input type="date" value={formData.reportDate} className="input-field"
                onChange={e => setFormData(p => ({ ...p, reportDate: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>เวลาปฏิบัติหน้าที่ <span style={{ color: '#f44336', fontSize: 14 }}>*</span></label>
              <input type="time" value={formData.dutyTime} className="input-field"
                onChange={e => setFormData(p => ({ ...p, dutyTime: e.target.value }))} />
            </div>
          </div>

          {/* Category (typeable + suggestions) */}
          <div style={{ position: 'relative' }}>
            <label style={labelStyle}>ประเภท</label>
            <input type="text" value={formData.category} className="input-field"
              placeholder="พิมพ์หรือเลือกประเภท"
              onChange={e => { setFormData(p => ({ ...p, category: e.target.value })); setShowCatDropdown(true); }}
              onFocus={() => setShowCatDropdown(true)}
              onBlur={() => setTimeout(() => setShowCatDropdown(false), 150)}
            />
            {showCatDropdown && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                background: 'white', border: `2px solid ${LIGHT_BLUE}`, borderRadius: 8,
                maxHeight: 200, overflowY: 'auto', marginTop: 4,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}>
                {allCategories
                  .filter(c => c.toLowerCase().includes((formData.category || '').toLowerCase()))
                  .map(c => (
                    <div key={c}
                      onMouseDown={() => { setFormData(p => ({ ...p, category: c })); setShowCatDropdown(false); }}
                      style={{
                        padding: '10px 14px', cursor: 'pointer', fontSize: 15,
                        background: formData.category === c ? LIGHT_BLUE : 'white',
                        borderBottom: `1px solid ${LIGHT_BLUE}`,
                      }}
                    >
                      {c}
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Tags (typeable + saved suggestions) */}
          <div>
            <label style={labelStyle}>แท็ก</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" value={formData.tagInput} className="input-field"
                placeholder="พิมพ์แท็กแล้ว Enter"
                style={{ flex: 1 }}
                onChange={e => setFormData(p => ({ ...p, tagInput: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = formData.tagInput.replace(/^#/, '').trim();
                    if (val && !formData.tags.includes(val)) {
                      setFormData(p => ({ ...p, tags: [...p.tags, val], tagInput: '' }));
                    }
                  }
                }} />
              <button type="button" onClick={() => {
                const val = formData.tagInput.replace(/^#/, '').trim();
                if (val && !formData.tags.includes(val)) {
                  setFormData(p => ({ ...p, tags: [...p.tags, val], tagInput: '' }));
                }
              }} style={{
                padding: '0 14px', background: BLUE, color: 'white', border: 'none',
                borderRadius: 8, fontSize: 18, cursor: 'pointer', fontWeight: 700,
              }}>+</button>
            </div>

            {/* Selected tags */}
            {formData.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {formData.tags.map((tag, i) => (
                  <span key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: LIGHT_BLUE, color: DARK_BLUE, padding: '4px 10px',
                    borderRadius: 20, fontSize: 13, fontWeight: 600,
                  }}>
                    #{tag}
                    <button onClick={() => setFormData(p => ({ ...p, tags: p.tags.filter((_, j) => j !== i) }))}
                      style={{ background: 'none', border: 'none', color: DARK_BLUE, cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Saved tag suggestions */}
            {allSavedTags.filter(t => !formData.tags.includes(t)).length > 0 && (
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 12, color: '#999' }}>แท็กที่เคยใช้:</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {allSavedTags.filter(t => !formData.tags.includes(t)).map(tag => (
                    <button key={tag} type="button"
                      onClick={() => setFormData(p => ({ ...p, tags: [...p.tags, tag] }))}
                      style={{
                        background: 'white', border: `1.5px solid ${LIGHT_BLUE}`, color: DARK_BLUE,
                        padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                        cursor: 'pointer', fontFamily: 'Sarabun, sans-serif',
                      }}>
                      + #{tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Row: Name (readonly) + Position (readonly) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>ผู้รายงาน</label>
              <input type="text" value={formData.staffName} className="input-field"
                readOnly style={{ background: '#f5f5f5', color: '#666' }} />
            </div>
            <div>
              <label style={labelStyle}>ตำแหน่ง</label>
              <input type="text" value={formData.position} className="input-field"
                readOnly style={{ background: '#f5f5f5', color: '#666' }} />
            </div>
          </div>

          {/* Location */}
          <div>
            <label style={labelStyle}>สถานที่ <span style={{ color: '#f44336', fontSize: 14 }}>*</span></label>
            <input type="text" value={formData.location} className="input-field" placeholder="ระบุสถานที่ปฏิบัติหน้าที่"
              onChange={e => setFormData(p => ({ ...p, location: e.target.value }))} />
          </div>

          {/* Activity */}
          <div>
            <label style={labelStyle}>กิจกรรมที่ปฏิบัติ <span style={{ color: '#f44336', fontSize: 14 }}>*</span></label>
            <textarea value={formData.activity} className="input-field" rows={3}
              placeholder="รายละเอียดกิจกรรมที่ปฏิบัติ"
              style={{ resize: 'vertical' }}
              onChange={e => setFormData(p => ({ ...p, activity: e.target.value }))} />
          </div>

          {/* Event Detail */}
          <div>
            <label style={labelStyle}>เหตุการณ์และรายละเอียด</label>
            <textarea value={formData.eventDetail} className="input-field" rows={2}
              placeholder="เหตุการณ์ทั่วไปปกติ"
              style={{ resize: 'vertical' }}
              onChange={e => setFormData(p => ({ ...p, eventDetail: e.target.value }))} />
          </div>

          {/* Note */}
          <div>
            <label style={labelStyle}>หมายเหตุ</label>
            <input type="text" value={formData.note} className="input-field" placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
              onChange={e => setFormData(p => ({ ...p, note: e.target.value }))} />
          </div>

          {/* Images */}
          <div>
            <label style={labelStyle}>
              รูปถ่าย <span style={{ color: '#f44336', fontSize: 14 }}>*</span>
              <span style={{ fontWeight: 400, color: '#999', fontSize: 13, marginLeft: 8 }}>
                ({formData.images.length}/{MAX_IMAGES})
              </span>
            </label>

            {formData.images.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8, marginBottom: 12 }}>
                {formData.images.map((img, idx) => (
                  <div key={idx} style={{ position: 'relative' }}>
                    <img src={img.preview} alt={`รูปที่ ${idx + 1}`}
                      style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 8, border: `2px solid ${LIGHT_BLUE}` }} />
                    <button onClick={() => removeImageFromForm(idx)} style={{
                      position: 'absolute', top: -6, right: -6, width: 22, height: 22,
                      borderRadius: '50%', background: '#f44336', color: 'white',
                      border: 'none', cursor: 'pointer', fontSize: 12, lineHeight: '22px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {formData.images.length < MAX_IMAGES && (
              <label style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: 16, border: `2px dashed ${LIGHT_BLUE}`, borderRadius: 10,
                cursor: 'pointer', color: BLUE, fontWeight: 600, fontSize: 15,
                transition: 'all 0.2s',
              }}>
                <span style={{ fontSize: 22 }}>+</span> เพิ่มรูปภาพ
                <input type="file" accept="image/*" multiple hidden
                  onChange={e => {
                    Array.from(e.target.files).forEach(f => addImageToForm(f));
                    e.target.value = '';
                  }} />
              </label>
            )}
          </div>
        </div>

        {/* Submit */}
        <button className="save-btn" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'กำลังบันทึก...' : 'บันทึกรายงาน'}
        </button>
      </div>
    </div>
  );
}

export default App;
