import React, { useState, useEffect, useRef } from 'react';

const SUPABASE_URL = 'https://ikfioqvjrhquiyeylmsv.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZmlvcXZqcmhxdWl5ZXlsbXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4MzQ3MTcsImV4cCI6MjA2NjQxMDcxN30.m0RHqLl6RmM5rTN-TU3YrcvHNpSB9FnH_XN_Y3uhhRc';
const API_BASE = `${SUPABASE_URL}/functions/v1`;
const REST_BASE = `${SUPABASE_URL}/rest/v1`;
const UPLOAD_URL = `${API_BASE}/upload-report-image`;

const BLUE       = '#2196F3';
const DARK_BLUE  = '#1976D2';
const LIGHT_BLUE = '#E3F2FD';

/* ─── Dropdown Options ─── */
const SERVICE_UNITS = [
  'หน่วยบริการเมืองลพบุรี', 'หน่วยบริการพัฒนานิคม', 'หน่วยบริการโคกสำโรง',
  'หน่วยบริการชัยบาดาล', 'หน่วยบริการท่าวุ้ง', 'หน่วยบริการบ้านหมี่',
  'หน่วยบริการท่าหลวง', 'หน่วยบริการสระโบสถ์', 'หน่วยบริการโคกเจริญ',
  'หน่วยบริการลำสนธิ', 'หน่วยบริการหนองม่วง',
];

const DISABILITY_TYPES = [
  'บกพร่องทางการเห็น', 'บกพร่องทางการได้ยิน', 'บกพร่องทางสติปัญญา',
  'บกพร่องทางร่างกายหรือการเคลื่อนไหวหรือสุขภาพ',
  'บกพร่องทางการเรียนรู้', 'บกพร่องทางการพูดและภาษา',
  'บกพร่องทางพฤติกรรมหรืออารมณ์', 'ออทิสติก', 'พิการซ้ำซ้อน',
];

/* ─── Report Types Config ─── */
const REPORT_TYPES = {
  duty: {
    key: 'duty', label: 'ดูแลนักเรียน (ศูนย์ฯ)',
    fullName: 'ดูแลนักเรียน (ศูนย์ฯ)',
    icon: '📋', formType: 'duty', maxImages: 5,
    colors: { primary: '#2196F3', dark: '#1976D2', light: '#E3F2FD' },
  },
  lunch: {
    key: 'lunch', label: 'อาหารกลางวัน (หน่วยฯ)',
    fullName: 'อาหารกลางวัน (หน่วยฯ)',
    icon: '🍱', formType: 'lunch', maxImages: 5,
    colors: { primary: '#4CAF50', dark: '#388E3C', light: '#E8F5E9' },
  },
  ei_service: {
    key: 'ei_service', label: 'บริการ EI',
    fullName: 'บริการ EI',
    icon: '🤝', formType: 'ei_service', maxImages: 5,
    colors: { primary: '#FF9800', dark: '#F57C00', light: '#FFF3E0' },
  },
  student_dev: {
    key: 'student_dev', label: 'พัฒนาผู้เรียน',
    fullName: 'พัฒนาผู้เรียน (Online/Onsite)',
    icon: '📚', formType: 'student_dev', maxImages: 5,
    colors: { primary: '#00BCD4', dark: '#0097A7', light: '#E0F7FA' },
  },
  other: {
    key: 'other', label: 'อื่นๆ',
    fullName: '',
    icon: '📝', formType: 'other', maxImages: 99,
    colors: { primary: '#607D8B', dark: '#455A64', light: '#ECEFF1' },
  },
};

/* ─── field mapping helpers ─── */
const buildTags = (form, reportType) => {
  const tags = [];
  if (form.reportDate) tags.push(`report_date:${form.reportDate}`);
  if (form.dutyTime)   tags.push(`duty_time:${form.dutyTime}`);
  if (reportType)      tags.push(`report_type:${reportType}`);
  if (Array.isArray(form.tags)) form.tags.forEach(t => tags.push(t));
  return tags;
};

const buildTitle = (form, reportType) => {
  const type = REPORT_TYPES[reportType];
  if (!type) return form.activity || '-';
  switch (type.formType) {
    case 'duty':        return form.activity || type.fullName;
    case 'lunch':       return type.fullName;
    case 'ei_service':  return type.fullName;
    case 'student_dev': return `${type.fullName} - ${form.serviceUnit || ''}`.trim();
    case 'other':       return form.customCategoryName || 'อื่นๆ';
    default:            return form.activity || '-';
  }
};

const buildDescription = (form, reportType) => {
  const type = REPORT_TYPES[reportType];
  if (!type) return form.activity || '-';
  const parts = [];
  switch (type.formType) {
    case 'duty':
      if (form.eventDetail) parts.push(form.eventDetail);
      if (form.note) parts.push(`หมายเหตุ: ${form.note}`);
      if (form.dutyExchanges?.length > 0)
        parts.push(`การแลกเปลี่ยน:\n${form.dutyExchanges.map(e => `  ${e.personA} ↔ ${e.personB}`).join('\n')}`);
      return parts.length > 0 ? parts.join('\n') : (form.activity || '-');
    case 'lunch':
      parts.push(`ห้องเรียน/หน่วยบริการ: ${form.workplace || '-'}`);
      if (form.foodMenus?.length > 0)
        parts.push(`เมนูอาหาร:\n${form.foodMenus.map((m, i) => `  ${i + 1}. ${m}`).join('\n')}`);
      if (form.note) parts.push(`หมายเหตุ: ${form.note}`);
      return parts.length > 0 ? parts.join('\n') : '-';
    case 'ei_service':
      parts.push(`ห้องเรียน/หน่วยบริการ: ${form.workplace || '-'}`);
      parts.push(`จำนวนนักเรียน: ${form.studentCount || '-'}`);
      parts.push(`จำนวนผู้ปกครอง: ${form.parentCount || '-'}`);
      parts.push(`กิจกรรมการจัดให้บริการ: ${form.serviceActivity || '-'}`);
      if (form.note) parts.push(`อื่นๆ: ${form.note}`);
      return parts.join('\n');
    case 'student_dev':
      parts.push(`รูปแบบ: ${form.learningMode || '-'}`);
      parts.push(`ห้องเรียน/หน่วยบริการ: ${form.serviceUnit || '-'}`);
      parts.push(`กิจกรรมการสอน: ${form.teachingActivity || '-'}`);
      if (form.students.length > 0)
        parts.push(`ผู้เรียน:\n${form.students.map((s, i) => `  ${i + 1}. ${s.name} (${s.disabilityType})`).join('\n')}`);
      if (form.learningActivities.length > 0)
        parts.push(`กิจกรรมการเรียนรู้:\n${form.learningActivities.map((a, i) => `  ${i + 1}. ${a}`).join('\n')}`);
      if (form.guidance) parts.push(`การให้คำแนะนำ: ${form.guidance}`);
      if (form.obstacles.length > 0)
        parts.push(`ปัญหา/อุปสรรค:\n${form.obstacles.map((o, i) => `  ${i + 1}. ${o}`).join('\n')}`);
      return parts.join('\n');
    case 'other':
      if (form.note) parts.push(`หมายเหตุ: ${form.note}`);
      return parts.length > 0 ? parts.join('\n') : '';
    default:
      return '-';
  }
};

const buildCategory = (form, reportType) => {
  const type = REPORT_TYPES[reportType];
  if (!type) return 'อื่นๆ';
  if (type.formType === 'other') return form.customCategoryName || 'อื่นๆ';
  return type.fullName;
};

const buildFormData = (form, reportType) => {
  const type = REPORT_TYPES[reportType];
  if (!type) return {};
  const base = {
    reportType,
    formType: type.formType,
    reportDate: form.reportDate,
    dutyTime: form.dutyTime,
    staffName: form.staffName,
    position: form.position,
    location: form.location,
    tags: form.tags,
  };
  switch (type.formType) {
    case 'duty':
      return { ...base, activity: form.activity, eventDetail: form.eventDetail, note: form.note, dutyExchanges: form.dutyExchanges };
    case 'lunch':
      return { ...base, workplace: form.workplace, foodMenus: form.foodMenus, note: form.note };
    case 'ei_service':
      return { ...base, workplace: form.workplace, studentCount: form.studentCount, parentCount: form.parentCount, serviceActivity: form.serviceActivity, note: form.note };
    case 'student_dev':
      return {
        ...base,
        learningMode: form.learningMode,
        serviceUnit: form.serviceUnit,
        teachingActivity: form.teachingActivity,
        students: form.students,
        learningActivities: form.learningActivities,
        guidance: form.guidance,
        obstacles: form.obstacles,
      };
    case 'other':
      return { ...base, customCategoryName: form.customCategoryName, note: form.note };
    default:
      return base;
  }
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

  /* ── Report step & type ── */
  const [reportStep, setReportStep] = useState('select'); // 'select' | 'form'
  const [reportType, setReportType] = useState(null);     // key from REPORT_TYPES

  /* ── Form state ── */
  const emptyForm = {
    reportDate: '', dutyTime: '', staffName: '', position: '',
    location: '', activity: '', eventDetail: '', note: '',
    tags: [], tagInput: '',
    images: [],
    learningMode: '',
    learningActivities: [], learningActivityInput: '',
    obstacles: [], obstacleInput: '',
    customCategoryName: '',
    workplace: '',
    foodMenus: [], foodMenuInput: '',
    dutyExchanges: [],
    dutyExchangeA: '', dutyExchangeB: '',
    // EI fields
    studentCount: '', parentCount: '', serviceActivity: '',
    // Student Dev fields
    serviceUnit: '', teachingActivity: '',
    students: [], studentNameInput: '', studentDisabilityInput: '',
    guidance: '',
  };
  const [formData,   setFormData]   = useState(emptyForm);
  const [studentDevStep, setStudentDevStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, step: '' });
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  /* ── Upload abort controller ── */
  const uploadAbortRef = useRef(null);

  /* ── Shared categories & tags (DB) ── */
  const [dbCategories, setDbCategories] = useState([]);
  const [dbTags, setDbTags] = useState([]);

  /* ── Derived ── */
  const typeConfig = reportType ? REPORT_TYPES[reportType] : null;
  const colors = typeConfig ? typeConfig.colors : { primary: BLUE, dark: DARK_BLUE, light: LIGHT_BLUE };
  const labelStyle = { display: 'block', fontWeight: 600, color: colors.dark, marginBottom: 8, fontSize: 15 };
  const allSavedTags = [...new Set([...dbTags])];

  /* ── Init: check localStorage ── */
  useEffect(() => {
    const token   = localStorage.getItem('ext_token');
    const profile = localStorage.getItem('ext_profile');
    if (token && profile) {
      try {
        const p = JSON.parse(profile);
        setAuthToken(token);
        setUserProfile(p);
        setFormData(prev => ({
          ...prev,
          reportDate: getCurrentDate(),
          dutyTime: getCurrentTime(),
          staffName: p.name || '',
          position: p.position || '',
          workplace: p.workplace || '',
        }));

        // Refresh profile from DB to get latest data (e.g. workplace updates)
        fetch(`${API_BASE}/get-my-profile`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }).then(r => r.ok ? r.json() : null).then(data => {
          if (data?.success && data.profile) {
            const fresh = data.profile;
            localStorage.setItem('ext_profile', JSON.stringify(fresh));
            setUserProfile(fresh);
            setFormData(prev => ({
              ...prev,
              staffName: fresh.name || prev.staffName,
              position: fresh.position || prev.position,
              workplace: fresh.workplace || prev.workplace,
            }));
          }
        }).catch(() => {});
      } catch { /* invalid profile, stay on login */ }

      // Cleanup orphaned uploads from interrupted sessions
      try {
        const pending = JSON.parse(localStorage.getItem('pending_uploads') || '[]');
        if (pending.length > 0) {
          const files = pending
            .map(u => {
              const prefix = `${SUPABASE_URL}/storage/v1/object/public/report-images/`;
              return u.startsWith(prefix) ? u.slice(prefix.length) : null;
            })
            .filter(Boolean);
          if (files.length > 0) {
            fetch(UPLOAD_URL, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ files }),
            }).catch(() => {});
          }
          localStorage.removeItem('pending_uploads');
        }
      } catch { localStorage.removeItem('pending_uploads'); }
    }
    // Load shared categories & tags from DB
    fetchCategories();
    fetchTags();
  }, []);

  /* ── Abort upload on network loss / warn before page close ── */
  useEffect(() => {
    const handleOffline = () => {
      if (uploadAbortRef.current) {
        uploadAbortRef.current.abort();
      }
    };
    const handleBeforeUnload = (e) => {
      if (uploadAbortRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    // Fix white screen on mobile when switching back from another app
    // Skip repaint if upload is in progress (page is clearly still alive)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !uploadAbortRef.current) {
        requestAnimationFrame(() => {
          document.documentElement.style.display = 'none';
          void document.documentElement.offsetHeight;
          document.documentElement.style.display = '';
        });
      }
    };
    // BFCache restore: page restored from back/forward cache → reload
    const handlePageShow = (e) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
    };
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

  /* ─── helpers ─── */
  const getCurrentDate = () => new Date().toISOString().split('T')[0];
  const getCurrentTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

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
        setFormData(prev => ({
          ...prev,
          reportDate: getCurrentDate(),
          dutyTime: getCurrentTime(),
          staffName: data.profile.name || '',
          position: data.profile.position || '',
          workplace: data.profile.workplace || '',
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
    setReportStep('select');
    setReportType(null);
  };

  /* ═══════════════════════════════════════════
     IMAGE COMPRESS & UPLOAD
     ═══════════════════════════════════════════ */

  const compressImage = (file) => new Promise((resolve) => {
    // Skip if already small (< 200KB)
    if (file.size < 200 * 1024) { resolve(file); return; }

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1920;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width  = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob || blob.size >= file.size) { resolve(file); return; }
        resolve(new File([blob], file.name, { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.8);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });

  const uploadImage = async (rawFile, signal, sessionId) => {
    const file = await compressImage(rawFile);
    const ext  = file.name.split('.').pop();
    const name = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': file.type || 'image/jpeg',
      'x-file-name': name,
    };
    if (sessionId) headers['x-session-id'] = sessionId;
    const res = await fetch(UPLOAD_URL, {
      method: 'POST', headers, body: file, signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data.url;
  };

  /* Extract file name from public URL for deletion */
  const fileNameFromUrl = (url) => {
    const prefix = `${SUPABASE_URL}/storage/v1/object/public/report-images/`;
    return url.startsWith(prefix) ? url.slice(prefix.length) : null;
  };

  /* Delete uploaded images from storage (cleanup on failure) */
  const deleteUploadedImages = async (urls) => {
    const files = urls.map(fileNameFromUrl).filter(Boolean);
    if (files.length === 0) return;
    try {
      await fetch(UPLOAD_URL, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files }),
      });
    } catch { /* best-effort cleanup */ }
  };

  const startSession = async () => {
    try {
      const res = await fetch(UPLOAD_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start-session' }),
      });
      const data = await res.json();
      return data.session_id || null;
    } catch { return null; }
  };

  const commitSession = async (sessionId) => {
    if (!sessionId) return;
    try {
      await fetch(UPLOAD_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'commit-session', session_id: sessionId }),
      });
    } catch { /* best-effort */ }
  };

  const uploadAllImages = async (images) => {
    const total = images.filter(img => img.file).length;
    let current = 0;
    setUploadProgress({ current: 0, total, step: 'upload' });
    const uploadedUrls = [];
    localStorage.setItem('pending_uploads', JSON.stringify([]));

    // Start server-side session (server will auto-cleanup if not committed)
    const sessionId = await startSession();

    // Create AbortController so offline/beforeunload can cancel uploads
    const abortCtrl = new AbortController();
    uploadAbortRef.current = abortCtrl;

    try {
      for (const img of images) {
        if (img.file) {
          current++;
          setUploadProgress({ current, total, step: 'upload' });
          const url = await uploadImage(img.file, abortCtrl.signal, sessionId);
          uploadedUrls.push(url);
          localStorage.setItem('pending_uploads', JSON.stringify(uploadedUrls));
        } else if (img.existingUrl) {
          uploadedUrls.push(img.existingUrl);
        }
      }
      return { urls: uploadedUrls, sessionId };
    } catch (err) {
      // Client-side fast cleanup (server will also cleanup after 30 min)
      await deleteUploadedImages(uploadedUrls);
      localStorage.removeItem('pending_uploads');
      const isAbort = err.name === 'AbortError';
      throw isAbort ? new Error('การอัปโหลดถูกยกเลิก (สัญญาณขาดหาย)') : err;
    } finally {
      uploadAbortRef.current = null;
    }
  };

  const addImageToForm = (file) => {
    setFormData(p => {
      if (p.images.length >= (typeConfig?.maxImages || 5)) return p;
      return { ...p, images: [...p.images, { file, preview: URL.createObjectURL(file), existingUrl: null }] };
    });
  };

  const removeImageFromForm = (idx) => {
    setFormData(p => ({ ...p, images: p.images.filter((_, i) => i !== idx) }));
  };

  /* ═══════════════════════════════════════════
     REPORT TYPE SELECTION
     ═══════════════════════════════════════════ */

  const handleSelectType = (key) => {
    setReportType(key);
    setReportStep('form');
    setStudentDevStep(1);
    setFormData(prev => ({
      ...emptyForm,
      reportDate: getCurrentDate(),
      dutyTime: getCurrentTime(),
      staffName: prev.staffName,
      position: prev.position,
      workplace: prev.workplace,
    }));
  };

  /* ═══════════════════════════════════════════
     CREATE POST
     ═══════════════════════════════════════════ */

  const handleSubmit = async () => {
    const type = REPORT_TYPES[reportType];
    if (!type) return;

    // Common validation
    const needsLocation = type.formType === 'duty';
    if (!formData.reportDate || !formData.dutyTime || (needsLocation && !formData.location) || formData.images.length === 0) {
      const msg = needsLocation
        ? 'กรุณากรอกข้อมูลที่จำเป็นให้ครบ (วันที่, เวลา, สถานที่, รูปถ่าย)'
        : 'กรุณากรอกข้อมูลที่จำเป็นให้ครบ (วันที่, เวลา, รูปถ่าย)';
      showNotif(msg, 'error');
      return;
    }

    // Type-specific validation
    switch (type.formType) {
      case 'duty':
        if (!formData.activity) {
          showNotif('กรุณากรอกกิจกรรมที่ปฏิบัติ', 'error');
          return;
        }
        break;
      case 'lunch':
        break;
      case 'ei_service':
        if (!formData.serviceActivity) {
          showNotif('กรุณากรอกกิจกรรมการจัดให้บริการ', 'error');
          return;
        }
        break;
      case 'student_dev':
        if (!formData.learningMode || !formData.serviceUnit || !formData.teachingActivity || formData.students.length === 0 || formData.learningActivities.length === 0) {
          showNotif('กรุณากรอกข้อมูลที่จำเป็นให้ครบ (รูปแบบ, ห้องเรียน/หน่วยบริการ, กิจกรรมการสอน, ชื่อผู้เรียน, กิจกรรมการเรียนรู้)', 'error');
          return;
        }
        break;
      case 'other':
        if (!formData.customCategoryName) {
          showNotif('กรุณากรอกชื่อรายงาน', 'error');
          return;
        }
        break;
    }

    setSubmitting(true);
    let uploadedImages = [];
    let sessionId = null;
    try {
      const result = await uploadAllImages(formData.images);
      uploadedImages = result.urls;
      sessionId = result.sessionId;
      setUploadProgress(p => ({ ...p, step: 'saving' }));
      await apiCall('/create-feed-post', {
        title: buildTitle(formData, reportType),
        description: buildDescription(formData, reportType),
        category: buildCategory(formData, reportType),
        tags: buildTags(formData, reportType),
        images: uploadedImages,
        location: type.formType === 'duty'
          ? (formData.location ? { name: formData.location } : null)
          : type.formType === 'student_dev'
          ? (formData.serviceUnit ? { name: formData.serviceUnit } : null)
          : (formData.workplace ? { name: formData.workplace } : null),
        report_type: reportType,
        form_data: buildFormData(formData, reportType),
      }, authToken);

      // Post created successfully — commit session & clear pending
      commitSession(sessionId);
      localStorage.removeItem('pending_uploads');

      // Save category & tags for future use
      saveCategory(buildCategory(formData, reportType));
      formData.tags.forEach(t => saveTag(t));

      showNotif('บันทึกรายงานสำเร็จ', 'success');
      setFormData(prev => ({
        ...emptyForm,
        reportDate: getCurrentDate(),
        dutyTime: getCurrentTime(),
        staffName: prev.staffName,
        position: prev.position,
        workplace: prev.workplace,
      }));
      setReportStep('select');
      setReportType(null);
    } catch (e) {
      // Cleanup uploaded images if create-feed-post failed
      if (uploadedImages.length > 0) {
        await deleteUploadedImages(uploadedImages);
      }
      localStorage.removeItem('pending_uploads');
      if (e.status === 401 && e.error === 'invalid_token') {
        showNotif('Token หมดอายุ กรุณาเข้าสู่ระบบใหม่', 'error');
        handleLogout();
        return;
      }
      showNotif('เกิดข้อผิดพลาดในการบันทึก: ' + (e.message || ''), 'error');
    }
    finally { setSubmitting(false); setUploadProgress({ current: 0, total: 0, step: '' }); }
  };

  /* ═══════════════════════════════════════════
     RENDER HELPERS
     ═══════════════════════════════════════════ */

  const renderTypeSelection = () => (
    <div className="fade-in" style={{ background: 'white', padding: 25, borderRadius: 15, boxShadow: '0 2px 15px rgba(0,0,0,0.08)' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#333', textAlign: 'center', margin: '0 0 20px' }}>
        เลือกประเภทรายงาน
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {Object.values(REPORT_TYPES).map(type => (
          <button key={type.key} onClick={() => handleSelectType(type.key)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              padding: '20px 12px', background: type.colors.light,
              border: `2px solid ${type.colors.primary}30`,
              borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s',
              fontFamily: 'Sarabun, sans-serif',
            }}>
            <span style={{ fontSize: 36 }}>{type.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: type.colors.dark, textAlign: 'center', lineHeight: 1.3 }}>
              {type.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderDateTimeFields = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div>
        <label style={labelStyle}>วันที่ <span style={{ color: '#f44336', fontSize: 14 }}>*</span></label>
        <input type="date" value={formData.reportDate} className="input-field"
          onChange={e => setFormData(p => ({ ...p, reportDate: e.target.value }))} />
      </div>
      <div>
        <label style={labelStyle}>เวลา <span style={{ color: '#f44336', fontSize: 14 }}>*</span></label>
        <input type="time" value={formData.dutyTime} className="input-field"
          onChange={e => setFormData(p => ({ ...p, dutyTime: e.target.value }))} />
      </div>
    </div>
  );

  const renderTagsField = () => (
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
          padding: '0 14px', background: colors.primary, color: 'white', border: 'none',
          borderRadius: 8, fontSize: 18, cursor: 'pointer', fontWeight: 700,
        }}>+</button>
      </div>

      {/* Selected tags */}
      {formData.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {formData.tags.map((tag, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: colors.light, color: colors.dark, padding: '4px 10px',
              borderRadius: 20, fontSize: 13, fontWeight: 600,
            }}>
              #{tag}
              <button onClick={() => setFormData(p => ({ ...p, tags: p.tags.filter((_, j) => j !== i) }))}
                style={{ background: 'none', border: 'none', color: colors.dark, cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>
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
                  background: 'white', border: `1.5px solid ${colors.light}`, color: colors.dark,
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
  );

  const renderStaffFields = () => (
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
  );

  const renderLocationField = () => (
    <div>
      <label style={labelStyle}>สถานที่ <span style={{ color: '#f44336', fontSize: 14 }}>*</span></label>
      <input type="text" value={formData.location} className="input-field" placeholder="ระบุสถานที่ปฏิบัติหน้าที่"
        onChange={e => setFormData(p => ({ ...p, location: e.target.value }))} />
    </div>
  );

  const renderWorkplaceField = () => (
    <div>
      <label style={labelStyle}>ห้องเรียน/หน่วยบริการ</label>
      <input type="text" value={formData.workplace} className="input-field"
        readOnly style={{ background: '#f5f5f5', color: '#666' }} />
    </div>
  );

  const renderLunchFields = () => {
    const addMenu = () => {
      const val = formData.foodMenuInput.trim();
      if (val && !formData.foodMenus.includes(val)) {
        setFormData(p => ({ ...p, foodMenus: [...p.foodMenus, val], foodMenuInput: '' }));
      }
    };
    const removeMenu = (idx) => {
      setFormData(p => ({ ...p, foodMenus: p.foodMenus.filter((_, i) => i !== idx) }));
    };
    return (
      <>
        <div>
          <label style={labelStyle}>เมนูอาหาร</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="text" value={formData.foodMenuInput} className="input-field"
              placeholder="พิมพ์เมนูอาหารแล้วกด +"
              style={{ flex: 1 }}
              onChange={e => setFormData(p => ({ ...p, foodMenuInput: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMenu(); } }}
            />
            <button type="button" onClick={addMenu}
              style={{
                padding: '0 14px', background: colors.primary, color: 'white', border: 'none',
                borderRadius: 8, fontSize: 18, cursor: 'pointer', fontWeight: 700,
              }}>+</button>
          </div>
          {formData.foodMenus.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {formData.foodMenus.map((item, idx) => (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: colors.light, padding: '8px 12px', borderRadius: 8, marginBottom: 4,
                  fontSize: 14,
                }}>
                  <span style={{ color: colors.dark }}>{idx + 1}. {item}</span>
                  <button onClick={() => removeMenu(idx)}
                    style={{ background: 'none', border: 'none', color: '#f44336', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <label style={labelStyle}>หมายเหตุ</label>
          <input type="text" value={formData.note} className="input-field" placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
            onChange={e => setFormData(p => ({ ...p, note: e.target.value }))} />
        </div>
      </>
    );
  };

  const renderDutyExchangeField = () => {
    const addExchange = () => {
      const a = formData.dutyExchangeA.trim();
      const b = formData.dutyExchangeB.trim();
      if (a && b) {
        setFormData(p => ({
          ...p,
          dutyExchanges: [...p.dutyExchanges, { personA: a, personB: b }],
          dutyExchangeA: '',
          dutyExchangeB: '',
        }));
      }
    };
    const removeExchange = (idx) => {
      setFormData(p => ({ ...p, dutyExchanges: p.dutyExchanges.filter((_, i) => i !== idx) }));
    };
    return (
      <div>
        <label style={labelStyle}>การแลกเปลี่ยนการปฏิบัติหน้าที่ <span style={{ fontWeight: 400, color: '#999', fontSize: 13 }}>(ไม่บังคับ)</span></label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="text" value={formData.dutyExchangeA} className="input-field"
            placeholder="ชื่อคนที่ 1"
            style={{ flex: 1, minWidth: 100 }}
            onChange={e => setFormData(p => ({ ...p, dutyExchangeA: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addExchange(); } }}
          />
          <span style={{ fontSize: 13, color: colors.dark, fontWeight: 600, whiteSpace: 'nowrap' }}>แลกเปลี่ยนกับ</span>
          <input type="text" value={formData.dutyExchangeB} className="input-field"
            placeholder="ชื่อคนที่ 2"
            style={{ flex: 1, minWidth: 100 }}
            onChange={e => setFormData(p => ({ ...p, dutyExchangeB: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addExchange(); } }}
          />
          <button type="button" onClick={addExchange}
            style={{
              padding: '0 14px', height: 44, background: colors.primary, color: 'white', border: 'none',
              borderRadius: 8, fontSize: 18, cursor: 'pointer', fontWeight: 700,
            }}>+</button>
        </div>
        {formData.dutyExchanges.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {formData.dutyExchanges.map((ex, idx) => (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: colors.light, padding: '8px 12px', borderRadius: 8, marginBottom: 4,
                fontSize: 14,
              }}>
                <span style={{ color: colors.dark }}>
                  {idx + 1}. {ex.personA} แลกเปลี่ยนการปฏิบัติหน้าที่กับ {ex.personB}
                </span>
                <button onClick={() => removeExchange(idx)}
                  style={{ background: 'none', border: 'none', color: '#f44336', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderImagesField = () => {
    const maxImages = typeConfig?.maxImages || 5;
    return (
      <div>
        <label style={labelStyle}>
          รูปถ่าย <span style={{ color: '#f44336', fontSize: 14 }}>*</span>
          <span style={{ fontWeight: 400, color: '#999', fontSize: 13, marginLeft: 8 }}>
            ({formData.images.length}/{maxImages})
          </span>
        </label>

        {formData.images.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8, marginBottom: 12 }}>
            {formData.images.map((img, idx) => (
              <div key={idx} style={{ position: 'relative' }}>
                <img src={img.preview} alt={`รูปที่ ${idx + 1}`}
                  style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 8, border: `2px solid ${colors.light}` }} />
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

        {formData.images.length < maxImages && (
          <label style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: 16, border: `2px dashed ${colors.primary}50`, borderRadius: 10,
            cursor: 'pointer', color: colors.primary, fontWeight: 600, fontSize: 15,
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
    );
  };

  /* ── List input (for learningActivities / obstacles) ── */
  const renderListInput = (listField, inputField, label, placeholder, required) => {
    const addItem = () => {
      const val = formData[inputField].trim();
      if (val && !formData[listField].includes(val)) {
        setFormData(p => ({ ...p, [listField]: [...p[listField], val], [inputField]: '' }));
      }
    };
    const removeItem = (idx) => {
      setFormData(p => ({ ...p, [listField]: p[listField].filter((_, i) => i !== idx) }));
    };
    return (
      <div>
        <label style={labelStyle}>
          {label}
          {required && <span style={{ color: '#f44336', fontSize: 14 }}> *</span>}
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input type="text" value={formData[inputField]} className="input-field"
            placeholder={placeholder}
            style={{ flex: 1 }}
            onChange={e => setFormData(p => ({ ...p, [inputField]: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
          />
          <button type="button" onClick={addItem}
            style={{
              padding: '0 14px', background: colors.primary, color: 'white', border: 'none',
              borderRadius: 8, fontSize: 18, cursor: 'pointer', fontWeight: 700,
            }}>+</button>
        </div>
        {formData[listField].length > 0 && (
          <div style={{ marginTop: 8 }}>
            {formData[listField].map((item, idx) => (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: colors.light, padding: '8px 12px', borderRadius: 8, marginBottom: 4,
                fontSize: 14,
              }}>
                <span style={{ color: colors.dark }}>{idx + 1}. {item}</span>
                <button onClick={() => removeItem(idx)}
                  style={{ background: 'none', border: 'none', color: '#f44336', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  /* ── Type-specific form fields ── */
  const renderDutyFields = () => (
    <>
      <div>
        <label style={labelStyle}>กิจกรรมที่ปฏิบัติ <span style={{ color: '#f44336', fontSize: 14 }}>*</span></label>
        <textarea value={formData.activity} className="input-field" rows={3}
          placeholder="รายละเอียดกิจกรรมที่ปฏิบัติ"
          style={{ resize: 'vertical' }}
          onChange={e => setFormData(p => ({ ...p, activity: e.target.value }))} />
      </div>
      {renderDutyExchangeField()}
      <div>
        <label style={labelStyle}>เหตุการณ์และรายละเอียด</label>
        <textarea value={formData.eventDetail} className="input-field" rows={2}
          placeholder="เหตุการณ์ทั่วไปปกติ"
          style={{ resize: 'vertical' }}
          onChange={e => setFormData(p => ({ ...p, eventDetail: e.target.value }))} />
      </div>
      <div>
        <label style={labelStyle}>หมายเหตุ</label>
        <input type="text" value={formData.note} className="input-field" placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
          onChange={e => setFormData(p => ({ ...p, note: e.target.value }))} />
      </div>
    </>
  );

  const renderEIFields = () => (
    <>
      <div>
        <label style={labelStyle}>จำนวนนักเรียนที่มารับบริการ</label>
        <input type="number" value={formData.studentCount} className="input-field" placeholder="ระบุจำนวน"
          inputMode="numeric" min="0"
          onChange={e => setFormData(p => ({ ...p, studentCount: e.target.value }))} />
      </div>
      <div>
        <label style={labelStyle}>จำนวนผู้ปกครองที่มารับบริการ</label>
        <input type="number" value={formData.parentCount} className="input-field" placeholder="ระบุจำนวน"
          inputMode="numeric" min="0"
          onChange={e => setFormData(p => ({ ...p, parentCount: e.target.value }))} />
      </div>
      <div>
        <label style={labelStyle}>กิจกรรมการจัดให้บริการ <span style={{ color: '#f44336', fontSize: 14 }}>*</span></label>
        <textarea value={formData.serviceActivity} className="input-field" rows={3}
          placeholder="รายละเอียดกิจกรรมการจัดให้บริการ"
          style={{ resize: 'vertical' }}
          onChange={e => setFormData(p => ({ ...p, serviceActivity: e.target.value }))} />
      </div>
      <div>
        <label style={labelStyle}>อื่นๆ <span style={{ fontWeight: 400, color: '#999', fontSize: 13 }}>(ไม่บังคับ)</span></label>
        <input type="text" value={formData.note} className="input-field" placeholder="ข้อมูลเพิ่มเติม (ถ้ามี)"
          onChange={e => setFormData(p => ({ ...p, note: e.target.value }))} />
      </div>
    </>
  );

  const renderStudentDevStep1 = () => {
    const type = REPORT_TYPES[reportType];
    return (
      <div className="fade-in" style={{
        background: 'white', padding: 25, borderRadius: 15,
        boxShadow: '0 2px 15px rgba(0,0,0,0.08)',
        '--theme-primary': colors.primary,
        '--theme-dark': colors.dark,
        '--theme-light': colors.light,
      }}>
        <button onClick={() => { setReportStep('select'); setReportType(null); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0',
            background: 'none', border: 'none', color: colors.dark,
            fontSize: 15, fontWeight: 600, cursor: 'pointer', marginBottom: 12,
            fontFamily: 'Sarabun, sans-serif',
          }}>
          ← เลือกประเภทใหม่
        </button>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: colors.light, color: colors.dark, padding: '8px 16px',
          borderRadius: 20, fontSize: 14, fontWeight: 600, marginBottom: 20,
          border: `1.5px solid ${colors.primary}30`,
        }}>
          <span>{type.icon}</span> {type.label}
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <div>
            <label style={labelStyle}>รูปแบบ <span style={{ color: '#f44336', fontSize: 14 }}>*</span></label>
            <select value={formData.learningMode} className="input-field"
              onChange={e => setFormData(p => ({ ...p, learningMode: e.target.value, serviceUnit: '' }))}>
              <option value="">-- เลือกรูปแบบ --</option>
              <option value="Onsite">Onsite</option>
              <option value="Online">Online</option>
            </select>
          </div>

          {formData.learningMode && (
            <div>
              <label style={labelStyle}>ห้องเรียน/หน่วยบริการ <span style={{ color: '#f44336', fontSize: 14 }}>*</span></label>
              <select value={formData.serviceUnit} className="input-field"
                onChange={e => {
                  const val = e.target.value;
                  setFormData(p => ({ ...p, serviceUnit: val }));
                  if (val) setStudentDevStep(2);
                }}>
                <option value="">-- เลือกห้องเรียน/หน่วยบริการ --</option>
                {SERVICE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderStudentDevStep2 = () => {
    const type = REPORT_TYPES[reportType];
    const addStudent = () => {
      const name = formData.studentNameInput.trim();
      const disability = formData.studentDisabilityInput;
      if (name && disability) {
        setFormData(p => ({
          ...p,
          students: [...p.students, { name, disabilityType: disability }],
          studentNameInput: '', studentDisabilityInput: '',
        }));
      }
    };
    const removeStudent = (idx) => {
      setFormData(p => ({ ...p, students: p.students.filter((_, i) => i !== idx) }));
    };
    const teachingOptions = formData.serviceUnit
      ? ['ที่บ้าน', `ที่${formData.serviceUnit}`]
      : ['ที่บ้าน'];

    return (
      <div className="fade-in" style={{
        background: 'white', padding: 25, borderRadius: 15,
        boxShadow: '0 2px 15px rgba(0,0,0,0.08)',
        '--theme-primary': colors.primary,
        '--theme-dark': colors.dark,
        '--theme-light': colors.light,
      }}>
        <button onClick={() => setStudentDevStep(1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0',
            background: 'none', border: 'none', color: colors.dark,
            fontSize: 15, fontWeight: 600, cursor: 'pointer', marginBottom: 12,
            fontFamily: 'Sarabun, sans-serif',
          }}>
          ← กลับ
        </button>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: colors.light, color: colors.dark, padding: '8px 16px',
          borderRadius: 20, fontSize: 14, fontWeight: 600, marginBottom: 12,
          border: `1.5px solid ${colors.primary}30`,
        }}>
          <span>{type.icon}</span> {type.label}
        </div>

        {/* Summary from step 1 */}
        <div style={{
          background: '#f8f9fa', padding: '10px 14px', borderRadius: 10,
          fontSize: 13, color: '#555', marginBottom: 20, lineHeight: 1.6,
        }}>
          <span style={{ fontWeight: 600 }}>รูปแบบ:</span> {formData.learningMode} &nbsp;|&nbsp;
          <span style={{ fontWeight: 600 }}>ห้องเรียน/หน่วยบริการ:</span> {formData.serviceUnit}
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          {renderDateTimeFields()}
          {renderTagsField()}
          {renderStaffFields()}

          {/* กิจกรรมการสอน */}
          <div>
            <label style={labelStyle}>กิจกรรมการสอน <span style={{ color: '#f44336', fontSize: 14 }}>*</span></label>
            <select value={formData.teachingActivity} className="input-field"
              onChange={e => setFormData(p => ({ ...p, teachingActivity: e.target.value }))}>
              <option value="">-- เลือกกิจกรรมการสอน --</option>
              {teachingOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* ชื่อผู้เรียน + ประเภทความพิการ */}
          <div>
            <label style={labelStyle}>ชื่อผู้เรียน <span style={{ color: '#f44336', fontSize: 14 }}>*</span></label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <input type="text" value={formData.studentNameInput} className="input-field"
                placeholder="ชื่อผู้เรียน" style={{ flex: 1, minWidth: 120 }}
                onChange={e => setFormData(p => ({ ...p, studentNameInput: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addStudent(); } }}
              />
              <select value={formData.studentDisabilityInput} className="input-field"
                style={{ flex: 1, minWidth: 140 }}
                onChange={e => setFormData(p => ({ ...p, studentDisabilityInput: e.target.value }))}>
                <option value="">-- ประเภทความพิการ --</option>
                {DISABILITY_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <button type="button" onClick={addStudent}
                style={{
                  padding: '0 14px', height: 44, background: colors.primary, color: 'white', border: 'none',
                  borderRadius: 8, fontSize: 18, cursor: 'pointer', fontWeight: 700,
                }}>+</button>
            </div>
            {formData.students.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {formData.students.map((s, idx) => (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: colors.light, padding: '8px 12px', borderRadius: 8, marginBottom: 4,
                    fontSize: 14,
                  }}>
                    <span style={{ color: colors.dark }}>
                      {idx + 1}. {s.name} ({s.disabilityType})
                    </span>
                    <button onClick={() => removeStudent(idx)}
                      style={{ background: 'none', border: 'none', color: '#f44336', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {renderListInput('learningActivities', 'learningActivityInput', 'กิจกรรมการเรียนรู้', 'พิมพ์กิจกรรมแล้วกด +', true)}

          {/* การให้คำแนะนำ */}
          <div>
            <label style={labelStyle}>การให้คำแนะนำ <span style={{ fontWeight: 400, color: '#999', fontSize: 13 }}>(ไม่บังคับ)</span></label>
            <textarea value={formData.guidance} className="input-field" rows={2}
              placeholder="การให้คำแนะนำ (ถ้ามี)"
              style={{ resize: 'vertical' }}
              onChange={e => setFormData(p => ({ ...p, guidance: e.target.value }))} />
          </div>

          {renderListInput('obstacles', 'obstacleInput', 'ปัญหา/อุปสรรค', 'พิมพ์ปัญหา/อุปสรรคแล้วกด +', false)}

          {renderImagesField()}
        </div>

        {/* Submit */}
        <button className="save-btn" onClick={handleSubmit} disabled={submitting}
          style={{ background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.dark} 100%)` }}>
          {submitting ? 'กำลังบันทึก...' : 'บันทึกรายงาน'}
        </button>
      </div>
    );
  };

  const renderOtherFields = () => (
    <>
      <div>
        <label style={labelStyle}>ชื่อรายงาน <span style={{ color: '#f44336', fontSize: 14 }}>*</span></label>
        <input type="text" value={formData.customCategoryName} className="input-field"
          placeholder="พิมพ์ชื่อรายงาน"
          onChange={e => setFormData(p => ({ ...p, customCategoryName: e.target.value }))} />
      </div>
      <div>
        <label style={labelStyle}>หมายเหตุ <span style={{ fontWeight: 400, color: '#999', fontSize: 13 }}>(ไม่บังคับ)</span></label>
        <input type="text" value={formData.note} className="input-field" placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
          onChange={e => setFormData(p => ({ ...p, note: e.target.value }))} />
      </div>
    </>
  );

  /* ── Form (Step 2) ── */
  const renderForm = () => {
    const type = REPORT_TYPES[reportType];

    // student_dev uses its own 2-step layout
    if (type.formType === 'student_dev') {
      return studentDevStep === 1 ? renderStudentDevStep1() : renderStudentDevStep2();
    }

    return (
      <div className="fade-in" style={{
        background: 'white', padding: 25, borderRadius: 15,
        boxShadow: '0 2px 15px rgba(0,0,0,0.08)',
        '--theme-primary': colors.primary,
        '--theme-dark': colors.dark,
        '--theme-light': colors.light,
      }}>
        {/* Back button */}
        <button onClick={() => { setReportStep('select'); setReportType(null); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0',
            background: 'none', border: 'none', color: colors.dark,
            fontSize: 15, fontWeight: 600, cursor: 'pointer', marginBottom: 12,
            fontFamily: 'Sarabun, sans-serif',
          }}>
          ← เลือกประเภทใหม่
        </button>

        {/* Type badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: colors.light, color: colors.dark, padding: '8px 16px',
          borderRadius: 20, fontSize: 14, fontWeight: 600, marginBottom: 20,
          border: `1.5px solid ${colors.primary}30`,
        }}>
          <span>{type.icon}</span>
          {type.formType === 'other' ? type.label : type.fullName || type.label}
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          {renderDateTimeFields()}
          {renderTagsField()}
          {renderStaffFields()}
          {type.formType === 'duty' && renderLocationField()}
          {['lunch', 'ei_service', 'other'].includes(type.formType) && renderWorkplaceField()}

          {/* Type-specific fields */}
          {type.formType === 'duty' && renderDutyFields()}
          {type.formType === 'lunch' && renderLunchFields()}
          {type.formType === 'ei_service' && renderEIFields()}
          {type.formType === 'other' && renderOtherFields()}

          {renderImagesField()}
        </div>

        {/* Submit */}
        <button className="save-btn" onClick={handleSubmit} disabled={submitting}
          style={{ background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.dark} 100%)` }}>
          {submitting ? 'กำลังบันทึก...' : 'บันทึกรายงาน'}
        </button>
      </div>
    );
  };

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
              <label style={{ display: 'block', fontWeight: 600, color: DARK_BLUE, marginBottom: 8, fontSize: 15 }}>เบอร์โทรศัพท์</label>
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
              <label style={{ display: 'block', fontWeight: 600, color: DARK_BLUE, marginBottom: 8, fontSize: 15 }}>รหัส OTP</label>
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

      {/* Upload Progress Modal */}
      {submitting && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: '32px 40px',
            textAlign: 'center', minWidth: 280, boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
          }}>
            {/* Spinner */}
            <div style={{
              width: 48, height: 48, border: `4px solid ${colors.light}`,
              borderTop: `4px solid ${colors.primary}`, borderRadius: '50%',
              margin: '0 auto 20px', animation: 'spin 0.8s linear infinite',
            }} />
            {uploadProgress.step === 'upload' ? (
              <>
                <div style={{ fontSize: 18, fontWeight: 700, color: colors.dark, marginBottom: 8 }}>
                  กำลังอัปโหลดรูปภาพ
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color: colors.primary, marginBottom: 8 }}>
                  {uploadProgress.current}/{uploadProgress.total}
                </div>
                {/* Progress bar */}
                <div style={{ background: colors.light, borderRadius: 10, height: 8, overflow: 'hidden' }}>
                  <div style={{
                    background: `linear-gradient(90deg, ${colors.primary}, ${colors.dark})`,
                    height: '100%', borderRadius: 10,
                    width: `${uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%`,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <div style={{ fontSize: 13, color: '#999', marginTop: 8 }}>
                  กรุณารอสักครู่...
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 18, fontWeight: 700, color: colors.dark, marginBottom: 8 }}>
                  กำลังบันทึกรายงาน
                </div>
                <div style={{ fontSize: 13, color: '#999' }}>
                  กรุณารอสักครู่...
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Header + User Info — always blue */}
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

      {/* Content: step-based */}
      {reportStep === 'select' ? renderTypeSelection() : renderForm()}
    </div>
  );
}

export default App;
