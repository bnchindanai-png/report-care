import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const TABLE = 'feed_posts';
const BUCKET = 'report-images';
const SECRET_PASSWORD = '123456';
const DIRECTOR_PASSWORD = '789012';
const MAX_IMAGES = 4;

const BLUE       = '#2196F3';
const DARK_BLUE  = '#1976D2';
const LIGHT_BLUE = '#E3F2FD';

/* ─── field mapping helpers ─── */

// tags = ["report_date:2024-01-15", "duty_time:08:00"]
const buildTags = (form) => {
  const tags = [];
  if (form.reportDate) tags.push(`report_date:${form.reportDate}`);
  if (form.dutyTime)   tags.push(`duty_time:${form.dutyTime}`);
  return tags;
};

const extractTag = (tags, key) => {
  if (!Array.isArray(tags)) return '';
  const found = tags.find(t => String(t).startsWith(`${key}:`));
  return found ? String(found).substring(key.length + 1) : '';
};

// description stores event_detail + note in readable format
const buildDescription = (form) => {
  const parts = [];
  if (form.eventDetail) parts.push(form.eventDetail);
  if (form.note)        parts.push(`หมายเหตุ: ${form.note}`);
  return parts.length > 0 ? parts.join('\n') : (form.activity || '-');
};

const parseDescription = (desc) => {
  if (!desc) return { eventDetail: '', note: '' };
  const sep = '\nหมายเหตุ: ';
  const idx = desc.indexOf(sep);
  if (idx === -1) return { eventDetail: desc, note: '' };
  return { eventDetail: desc.substring(0, idx), note: desc.substring(idx + sep.length) };
};

// images column is jsonb array in feed_posts
const parseImageUrls = (images) => {
  if (!images) return [];
  if (Array.isArray(images)) return images.filter(Boolean);
  try {
    const p = JSON.parse(images);
    if (Array.isArray(p)) return p.filter(Boolean);
  } catch { /* not json */ }
  return [images];
};

/* ════════════════════════════════════════════ */

function App() {
  const [activeTab, setActiveTab] = useState('create');
  const [dataRecords, setDataRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [showAckPopup,    setShowAckPopup]    = useState(false);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [showEditPopup,   setShowEditPopup]   = useState(false);
  const [selectedRecord,  setSelectedRecord]  = useState(null);

  const [directorPwd, setDirectorPwd] = useState('');
  const [password,    setPassword]    = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const emptyForm = {
    reportDate: '', dutyTime: '', staffName: '', position: '',
    location: '', activity: '', eventDetail: '', note: '',
    images: [], // { file, preview, existingUrl }
  };
  const [formData,     setFormData]     = useState(emptyForm);
  const [editFormData, setEditFormData] = useState(emptyForm);
  const [filterDate,   setFilterDate]   = useState('');

  /* Print state */
  const [showPrintPopup, setShowPrintPopup] = useState(false);
  const [printFrom, setPrintFrom] = useState('');
  const [printTo,   setPrintTo]   = useState('');
  const [printData, setPrintData] = useState(null); // null = not printing

  useEffect(() => {
    loadAllData();
    const today = getCurrentDate();
    setFilterDate(today);
    setFormData(p => ({ ...p, reportDate: today }));
  }, []);

  /* ─── helpers ─── */
  const getCurrentDate = () => new Date().toISOString().split('T')[0];

  const convertDateToThai = (ds) => {
    if (!ds) return 'ไม่ระบุวันที่';
    let s = String(ds);
    if (s.includes('T')) s = s.split('T')[0];
    const [y, m, d] = s.split('-').map(Number);
    if (!y) return s;
    return `${d}/${m}/${y + 543}`;
  };

  const showNotif = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  /* ─── data ─── */
  const loadAllData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(TABLE).select('*').order('created_at', { ascending: false });
      if (error) throw error;

      setDataRecords((data || []).map(r => {
        const tags = Array.isArray(r.tags) ? r.tags : [];
        const { eventDetail, note } = parseDescription(r.description);
        return {
          id:          r.id,
          reportDate:  extractTag(tags, 'report_date') || (r.created_at ? r.created_at.split('T')[0] : ''),
          dutyTime:    extractTag(tags, 'duty_time'),
          staffName:   r.author_name     || '',
          position:    r.author_position || '',
          location:    r.location ? (r.location.name || '') : '',
          activity:    r.title || '',
          eventDetail,
          note,
          imageUrl:    Array.isArray(r.images) && r.images.length > 0
                         ? JSON.stringify(r.images.filter(Boolean))
                         : '',
          acknowledged:   !!r.acknowledged_at,
          acknowledgedAt: r.acknowledged_at,
          timestamp:      r.created_at,
        };
      }));
    } catch (e) {
      showNotif('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + (e.message || ''), 'error');
    }
    finally { setLoading(false); }
  };

  const uploadImage = async (file) => {
    const ext  = file.name.split('.').pop();
    const name = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(name, file);
    if (error) throw error;
    return supabase.storage.from(BUCKET).getPublicUrl(name).data.publicUrl;
  };

  /* returns plain URL array for feed_posts.images (jsonb) */
  const uploadAllImages = async (images) => {
    const urls = [];
    for (const img of images) {
      if (img.file)         urls.push(await uploadImage(img.file));
      else if (img.existingUrl) urls.push(img.existingUrl);
    }
    return urls;
  };

  /* ─── add / remove image ─── */
  const addImageToForm = (setter, file) => {
    setter(p => {
      if (p.images.length >= MAX_IMAGES) return p;
      return { ...p, images: [...p.images, { file, preview: URL.createObjectURL(file), existingUrl: null }] };
    });
  };
  const removeImageFromForm = (setter, idx) => {
    setter(p => ({ ...p, images: p.images.filter((_, i) => i !== idx) }));
  };

  /* ─── CREATE ─── */
  const handleSubmit = async () => {
    if (!formData.staffName || !formData.reportDate || !formData.activity) {
      showNotif('กรุณากรอกชื่อ, วันที่ และกิจกรรม', 'error'); return;
    }
    setSubmitting(true);
    try {
      const images = await uploadAllImages(formData.images);
      const { error } = await supabase.from(TABLE).insert([{
        title:           formData.activity,
        description:     buildDescription(formData),
        category:        'รายงานหน้าที่',
        tags:            buildTags(formData),
        author_name:     formData.staffName,
        author_position: formData.position,
        images:          images,
        location:        formData.location ? { name: formData.location } : null,
      }]);
      if (error) throw error;
      showNotif('บันทึกรายงานสำเร็จ', 'success');
      setFormData({ ...emptyForm, reportDate: getCurrentDate() });
      await loadAllData();
    } catch (e) { showNotif('เกิดข้อผิดพลาดในการบันทึก: ' + (e.message || ''), 'error'); }
    finally { setSubmitting(false); }
  };

  /* ─── ACKNOWLEDGE ─── */
  const executeAck = async () => {
    if (directorPwd !== DIRECTOR_PASSWORD) { showNotif('รหัสผ่านผู้อำนวยการไม่ถูกต้อง', 'error'); return; }
    try {
      const { error } = await supabase.from(TABLE)
        .update({ acknowledged_at: new Date().toISOString() })
        .eq('id', selectedRecord.id);
      if (error) throw error;
      showNotif('รับทราบรายงานสำเร็จ', 'success');
      setShowAckPopup(false); setDirectorPwd(''); await loadAllData();
    } catch (e) { showNotif('เกิดข้อผิดพลาดในการรับทราบ: ' + (e.message || ''), 'error'); }
  };

  /* ─── EDIT ─── */
  const handleEdit = (r) => {
    setSelectedRecord(r);
    const existingUrls = parseImageUrls(r.imageUrl);
    setEditFormData({
      reportDate:   r.reportDate  || '', dutyTime:    r.dutyTime    || '',
      staffName:    r.staffName   || '', position:    r.position    || '',
      location:     r.location    || '', activity:    r.activity    || '',
      eventDetail:  r.eventDetail || '', note:        r.note        || '',
      images: existingUrls.map(url => ({ file: null, preview: url, existingUrl: url })),
    });
    setPassword(''); setShowEditPopup(true);
  };

  const executeEdit = async () => {
    if (password !== SECRET_PASSWORD) { showNotif('รหัสผ่านไม่ถูกต้อง', 'error'); return; }
    setSubmitting(true);
    try {
      const images = await uploadAllImages(editFormData.images);
      const { error } = await supabase.from(TABLE).update({
        title:           editFormData.activity,
        description:     buildDescription(editFormData),
        category:        'รายงานหน้าที่',
        tags:            buildTags(editFormData),
        author_name:     editFormData.staffName,
        author_position: editFormData.position,
        images:          images,
        location:        editFormData.location ? { name: editFormData.location } : null,
        updated_at:      new Date().toISOString(),
      }).eq('id', selectedRecord.id);
      if (error) throw error;
      showNotif('แก้ไขรายงานสำเร็จ', 'success');
      setShowEditPopup(false); setSelectedRecord(null); setPassword('');
      await loadAllData();
    } catch (e) { showNotif('เกิดข้อผิดพลาดในการแก้ไข: ' + (e.message || ''), 'error'); }
    finally { setSubmitting(false); }
  };

  /* ─── DELETE ─── */
  const handleDelete = (r) => { setSelectedRecord(r); setPassword(''); setShowDeletePopup(true); };

  const executeDelete = async () => {
    if (password !== SECRET_PASSWORD) { showNotif('รหัสผ่านไม่ถูกต้อง', 'error'); return; }
    try {
      const { error } = await supabase.from(TABLE).delete().eq('id', selectedRecord.id);
      if (error) throw error;
      showNotif('ลบรายงานสำเร็จ', 'success');
      setShowDeletePopup(false); setSelectedRecord(null); setPassword('');
      await loadAllData();
    } catch (e) { showNotif('เกิดข้อผิดพลาดในการลบ: ' + (e.message || ''), 'error'); }
  };

  /* ─── PRINT ─── */
  const openPrintPopup = () => {
    const today = getCurrentDate();
    setPrintFrom(today);
    setPrintTo(today);
    setShowPrintPopup(true);
  };

  const executePrint = () => {
    const from = printFrom || '0000-01-01';
    const to   = printTo   || '9999-12-31';
    const filtered = dataRecords
      .filter(r => {
        const d = String(r.reportDate || '').split('T')[0];
        return d >= from && d <= to;
      })
      .sort((a, b) => (a.reportDate || '').localeCompare(b.reportDate || ''));
    setPrintData({ records: filtered, from, to });
    setShowPrintPopup(false);
    setTimeout(() => { window.print(); setPrintData(null); }, 300);
  };

  /* ─── FORM FIELDS ─── */
  const renderFormFields = (data, setData) => (
    <div style={{ display: 'grid', gap: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <label style={labelStyle}>วันที่ <span style={{ color: '#f44336', fontSize: 14 }}>*</span></label>
          <input type="date" value={data.reportDate} className="input-field"
            onChange={e => setData(p => ({ ...p, reportDate: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>เวลาปฏิบัติหน้าที่</label>
          <input type="time" value={data.dutyTime} className="input-field"
            onChange={e => setData(p => ({ ...p, dutyTime: e.target.value }))} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <label style={labelStyle}>รายชื่อผู้ปฏิบัติหน้าที่ <span style={{ color: '#f44336', fontSize: 14 }}>*</span></label>
          <input type="text" placeholder="ชื่อและนามสกุล" value={data.staffName} className="input-field"
            onChange={e => setData(p => ({ ...p, staffName: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>ตำแหน่ง</label>
          <input type="text" placeholder="ตำแหน่ง" value={data.position} className="input-field"
            onChange={e => setData(p => ({ ...p, position: e.target.value }))} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>สถานที่</label>
        <input type="text" placeholder="กรุณาระบุสถานที่" value={data.location} className="input-field"
          onChange={e => setData(p => ({ ...p, location: e.target.value }))} />
      </div>

      <div>
        <label style={labelStyle}>กิจกรรมที่ปฏิบัติ <span style={{ color: '#f44336', fontSize: 14 }}>*</span></label>
        <textarea placeholder="กรุณาระบุกิจกรรมที่ปฏิบัติ" value={data.activity} rows={3} className="input-field"
          style={{ resize: 'vertical', minHeight: 100 }}
          onChange={e => setData(p => ({ ...p, activity: e.target.value }))} />
      </div>

      <div>
        <label style={labelStyle}>เหตุการณ์และรายละเอียด</label>
        <textarea placeholder="รายละเอียดเพิ่มเติม ถ้ามี" value={data.eventDetail} rows={3} className="input-field"
          style={{ resize: 'vertical', minHeight: 100 }}
          onChange={e => setData(p => ({ ...p, eventDetail: e.target.value }))} />
      </div>

      <div>
        <label style={labelStyle}>หมายเหตุ</label>
        <textarea placeholder="หมายเหตุ ถ้ามี" value={data.note} rows={2} className="input-field"
          style={{ resize: 'vertical' }}
          onChange={e => setData(p => ({ ...p, note: e.target.value }))} />
      </div>

      {/* Multi-image */}
      <div>
        <label style={labelStyle}>
          รูปภาพ
          <span style={{ fontWeight: 400, color: '#888', fontSize: 14, marginLeft: 8 }}>
            ({data.images.length}/{MAX_IMAGES} รูป)
          </span>
        </label>

        {data.images.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 12 }}>
            {data.images.map((img, idx) => (
              <div key={idx} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: `2px solid ${LIGHT_BLUE}` }}>
                <img src={img.preview} alt={`รูปที่ ${idx + 1}`}
                  style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} />
                <button onClick={() => removeImageFromForm(setData, idx)}
                  style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(244,67,54,0.9)', color: 'white', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', fontSize: 14, fontWeight: 700, lineHeight: '26px', padding: 0 }}>
                  ×
                </button>
                <div style={{ background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: 12, padding: '4px 8px', textAlign: 'center' }}>
                  รูปที่ {idx + 1}
                </div>
              </div>
            ))}
          </div>
        )}

        {data.images.length < MAX_IMAGES && (
          <label style={uploadZoneStyle}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = LIGHT_BLUE; }}
            onDragLeave={e => { e.currentTarget.style.background = ''; }}
            onDrop={e => {
              e.preventDefault(); e.currentTarget.style.background = '';
              Array.from(e.dataTransfer.files)
                .slice(0, MAX_IMAGES - data.images.length)
                .forEach(f => addImageToForm(setData, f));
            }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📷</div>
            <div style={{ color: '#666', fontSize: 15 }}>คลิกหรือลากรูปมาวางที่นี่</div>
            <div style={{ color: '#aaa', fontSize: 13, marginTop: 4 }}>เพิ่มได้อีก {MAX_IMAGES - data.images.length} รูป</div>
            <input type="file" accept="image/*" multiple style={{ display: 'none' }}
              onChange={e => {
                Array.from(e.target.files)
                  .slice(0, MAX_IMAGES - data.images.length)
                  .forEach(f => addImageToForm(setData, f));
                e.target.value = '';
              }} />
          </label>
        )}
      </div>
    </div>
  );

  /* ─── REPORT CARD ─── */
  const renderReportCard = (record, showActions) => {
    const imageUrls = parseImageUrls(record.imageUrl);
    return (
      <div key={record.id} className="report-item">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingBottom: 15, borderBottom: `2px solid ${LIGHT_BLUE}`, flexWrap: 'wrap', gap: 10 }}>
          <span style={{ color: DARK_BLUE, fontWeight: 700, fontSize: 18 }}>
            วันที่ {convertDateToThai(record.reportDate)}
            {record.dutyTime && ` เวลา ${record.dutyTime} น.`}
          </span>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {record.acknowledged && (
              <span style={{ background: 'linear-gradient(135deg, #4CAF50 0%, #388E3C 100%)', color: 'white', padding: '6px 12px', borderRadius: 20, fontSize: 14, fontWeight: 600 }}>
                ✓ ผู้อำนวยการรับทราบแล้ว
              </span>
            )}
            {showActions && (
              <>
                <button onClick={e => { e.stopPropagation(); handleEdit(record); }} style={btnStyle('#4CAF50')}>แก้ไข</button>
                <button onClick={e => { e.stopPropagation(); handleDelete(record); }} style={btnStyle('#f44336')}>ลบ</button>
              </>
            )}
            {!showActions && !record.acknowledged && (
              <button onClick={() => { setSelectedRecord(record); setShowAckPopup(true); }}
                style={btnStyle('#FF9800')}>รับทราบ</button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 15, marginBottom: 15 }}>
          {renderFieldItem("ผู้ปฏิบัติหน้าที่", record.staffName)}
          {renderFieldItem("ตำแหน่ง", record.position)}
          {renderFieldItem("สถานที่", record.location)}
          {renderFieldItem("กิจกรรมที่ปฏิบัติ", record.activity)}
          {record.eventDetail && renderFieldItem("เหตุการณ์และรายละเอียด", record.eventDetail)}
          {record.note        && renderFieldItem("หมายเหตุ", record.note)}
        </div>

        {imageUrls.length > 0 && (
          <div style={{ marginTop: 15 }}>
            <div style={{ color: DARK_BLUE, fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
              รูปภาพประกอบรายงาน ({imageUrls.length} รูป)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
              {imageUrls.map((url, idx) => (
                <img key={idx} src={url} alt={`รูปที่ ${idx + 1}`}
                  style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                  onError={e => e.target.style.display = 'none'} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFieldItem = (label, value) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontWeight: 600, color: DARK_BLUE, fontSize: 14, marginBottom: 4 }}>{label}</span>
      <span style={{ color: '#333', fontSize: 16, whiteSpace: 'pre-wrap' }}>{value || '-'}</span>
    </div>
  );

  const filteredData = dataRecords.filter(r => {
    if (activeTab !== 'daily') return true;
    if (!filterDate || !r.reportDate) return false;
    return String(r.reportDate).split('T')[0] === filterDate;
  });

  /* ─── POPUP WRAPPER ─── */
  const renderPopup = (show, wide, content) => !show ? null : (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) e.stopPropagation(); }}>
      <div style={{ background: 'white', padding: 30, borderRadius: 15, maxWidth: wide ? 700 : 500, width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        {content}
      </div>
    </div>
  );

  const popupActions = (onCancel, onConfirm, confirmLabel, danger = false) => (
    <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
      <button onClick={onCancel} style={popBtnStyle('#E3F2FD', DARK_BLUE)}>ยกเลิก</button>
      <button onClick={onConfirm} style={popBtnStyle(danger ? '#f44336' : BLUE, 'white')}>{confirmLabel}</button>
    </div>
  );

  /* ─── RENDER ─── */
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px' }}>

      {toast.show && (
        <div className="toast-slide hide-print" style={{
          position: 'fixed', top: 20, right: 20, zIndex: 1000, minWidth: 300,
          background: 'white', padding: '20px 25px', borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          borderLeft: `5px solid ${toast.type === 'success' ? '#4CAF50' : '#f44336'}`,
        }}>
          {toast.message}
        </div>
      )}

      {loading && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="spinner-circle" style={{ margin: '0 auto 20px' }} />
            <p style={{ fontSize: 18, fontWeight: 600, color: DARK_BLUE }}>กำลังโหลดข้อมูล...</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)', color: 'white', padding: 30, borderRadius: 15, textAlign: 'center', marginBottom: 30, boxShadow: '0 4px 15px rgba(33,150,243,0.3)' }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 10 }}>ระบบรายงานการปฏิบัติหน้าที่ดูแลนักเรียน</h1>
        <p style={{ fontSize: 18, opacity: 0.95 }}>ศูนย์การศึกษาพิเศษ เขตการศึกษา 6 จังหวัดลพบุรี</p>
      </div>

      {/* Navigation */}
      <div className="hide-print" style={{ display: 'flex', gap: 15, marginBottom: 25, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[
          { key: 'create', label: 'เพิ่มรายงานใหม่' },
          { key: 'all',    label: 'รายงานทั้งหมด'  },
          { key: 'daily',  label: 'รายงานประจำวัน' },
          { key: 'admin',  label: 'จัดการข้อมูล'   },
        ].map(t => (
          <button key={t.key} className={`nav-btn ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ background: 'white', padding: 30, borderRadius: 15, boxShadow: '0 2px 15px rgba(0,0,0,0.08)' }}>

        {activeTab === 'create' && (
          <>
            <h2 style={h2Style}>เพิ่มรายงานใหม่</h2>
            {renderFormFields(formData, setFormData)}
            <button className="save-btn" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'กำลังบันทึก...' : 'บันทึกรายงาน'}
            </button>
          </>
        )}

        {activeTab === 'all' && (
          <>
            <div style={{ marginBottom: 20 }}>
              <button onClick={openPrintPopup} className="hide-print" style={printBtnStyle}>
                พิมพ์รายงาน / บันทึก PDF
              </button>
            </div>
            <div style={countStyle}>{`จำนวนรายงานทั้งหมด ${dataRecords.length} รายการ`}</div>
            {dataRecords.length === 0 ? <NoData /> : dataRecords.map(r => renderReportCard(r, false))}
          </>
        )}

        {activeTab === 'daily' && (
          <>
            <div className="hide-print" style={{ display: 'flex', gap: 15, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                style={{ padding: '12px 15px', border: `2px solid ${LIGHT_BLUE}`, borderRadius: 8, fontSize: 16, fontFamily: 'Sarabun, sans-serif', outline: 'none' }} />
              <button onClick={loadAllData}
                style={{ padding: '12px 25px', background: BLUE, color: 'white', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sarabun, sans-serif' }}>
                ค้นหา
              </button>
              <button onClick={openPrintPopup} style={printBtnStyle}>
                🖨️ พิมพ์รายงาน / บันทึก PDF
              </button>
            </div>
            <div style={countStyle}>{`จำนวนรายงานวันที่ ${convertDateToThai(filterDate)} มี ${filteredData.length} รายการ`}</div>
            {filteredData.length === 0 ? <NoData /> : filteredData.map(r => renderReportCard(r, false))}
          </>
        )}

        {activeTab === 'admin' && (
          <>
            <div style={countStyle}>{`จำนวนรายงานทั้งหมด ${dataRecords.length} รายการ`}</div>
            {dataRecords.length === 0 ? <NoData /> : dataRecords.map(r => renderReportCard(r, true))}
          </>
        )}
      </div>

      {/* ══ ACKNOWLEDGE ══ */}
      {renderPopup(showAckPopup, false, <>
        <h3 style={popH3}>ยืนยันการรับทราบรายงาน</h3>
        <p style={{ color: '#666', marginBottom: 20 }}>กรุณาใส่รหัสผ่านผู้อำนวยการเพื่อยืนยัน</p>
        {selectedRecord && (
          <div style={{ background: '#fff3e0', padding: 15, borderRadius: 8, borderLeft: '4px solid #FF9800', marginBottom: 20, fontSize: 15 }}>
            <div><strong>วันที่:</strong> {convertDateToThai(selectedRecord.reportDate)}</div>
            <div><strong>เวลา:</strong> {selectedRecord.dutyTime || '-'}</div>
            <div><strong>ผู้ปฏิบัติหน้าที่:</strong> {selectedRecord.staffName}</div>
            <div><strong>ตำแหน่ง:</strong> {selectedRecord.position}</div>
          </div>
        )}
        <label style={labelStyle}>รหัสผ่านผู้อำนวยการ</label>
        <input type="password" className="input-field" value={directorPwd} autoFocus
          placeholder="กรุณาใส่รหัสผ่าน"
          onChange={e => setDirectorPwd(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && executeAck()} />
        {popupActions(() => { setShowAckPopup(false); setDirectorPwd(''); setSelectedRecord(null); }, executeAck, 'ยืนยันการรับทราบ')}
      </>)}

      {/* ══ EDIT ══ */}
      {renderPopup(showEditPopup, true, <>
        <div style={{ maxWidth: '100%' }}>
          <h3 style={popH3}>แก้ไขรายงาน</h3>
          {renderFormFields(editFormData, setEditFormData)}
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${LIGHT_BLUE}` }}>
            <label style={labelStyle}>รหัสผ่าน <span style={{ color: '#f44336' }}>*</span></label>
            <input type="password" className="input-field" value={password}
              placeholder="ใส่รหัสผ่านเพื่อยืนยันการแก้ไข"
              onChange={e => setPassword(e.target.value)} />
          </div>
          {popupActions(
            () => { setShowEditPopup(false); setSelectedRecord(null); setPassword(''); },
            executeEdit, submitting ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'
          )}
        </div>
      </>)}

      {/* ══ PRINT DATE RANGE ══ */}
      {renderPopup(showPrintPopup, false, <>
        <h3 style={popH3}>เลือกช่วงวันที่พิมพ์รายงาน</h3>
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <label style={labelStyle}>ตั้งแต่วันที่</label>
            <input type="date" className="input-field" value={printFrom}
              onChange={e => setPrintFrom(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>ถึงวันที่</label>
            <input type="date" className="input-field" value={printTo}
              onChange={e => setPrintTo(e.target.value)} />
          </div>
        </div>
        {popupActions(
          () => setShowPrintPopup(false),
          executePrint, 'พิมพ์รายงาน'
        )}
      </>)}

      {/* ══ PRINT VIEW (only visible during printing) ══ */}
      {printData && (
        <div className="print-view">
          <div style={{ textAlign: 'center', marginBottom: 24, borderBottom: '3px double #1976D2', paddingBottom: 16 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#1976D2' }}>
              ศูนย์การศึกษาพิเศษ เขตการศึกษา 6 จังหวัดลพบุรี
            </h1>
            <h2 style={{ fontSize: 17, fontWeight: 600, margin: '6px 0', color: '#333' }}>
              รายงานการปฏิบัติหน้าที่ดูแลนักเรียน
            </h2>
            <p style={{ fontSize: 14, color: '#555', margin: '4px 0 0' }}>
              ช่วงวันที่ {convertDateToThai(printData.from)} - {convertDateToThai(printData.to)}
              <span style={{ marginLeft: 16 }}>จำนวน {printData.records.length} รายการ</span>
            </p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#E3F2FD' }}>
                {['#', 'วันที่', 'เวลา', 'ผู้ปฏิบัติหน้าที่', 'ตำแหน่ง', 'สถานที่', 'กิจกรรม', 'เหตุการณ์/รายละเอียด', 'หมายเหตุ', 'สถานะ'].map((h, i) => (
                  <th key={i} style={{ border: '1px solid #ccc', padding: '6px 4px', fontWeight: 700, color: '#1976D2', textAlign: 'center', whiteSpace: i < 3 ? 'nowrap' : 'normal' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {printData.records.map((r, idx) => (
                <tr key={r.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f8fbff' }}>
                  <td style={tdStyle}>{idx + 1}</td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{convertDateToThai(r.reportDate)}</td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{r.dutyTime ? `${r.dutyTime} น.` : '-'}</td>
                  <td style={tdStyle}>{r.staffName || '-'}</td>
                  <td style={tdStyle}>{r.position || '-'}</td>
                  <td style={tdStyle}>{r.location || '-'}</td>
                  <td style={{ ...tdStyle, maxWidth: 180 }}>{r.activity || '-'}</td>
                  <td style={{ ...tdStyle, maxWidth: 180 }}>{r.eventDetail || '-'}</td>
                  <td style={tdStyle}>{r.note || '-'}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: r.acknowledged ? '#388E3C' : '#FF9800', fontWeight: 600 }}>
                    {r.acknowledged ? 'รับทราบ' : 'รอ'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <div style={{ textAlign: 'center', width: '45%' }}>
              <div style={{ borderTop: '1px solid #333', paddingTop: 8, marginTop: 50 }}>
                ลงชื่อ ............................................
              </div>
              <div style={{ marginTop: 4 }}>( .......................................... )</div>
              <div style={{ color: '#555', marginTop: 4 }}>ผู้รายงาน</div>
            </div>
            <div style={{ textAlign: 'center', width: '45%' }}>
              <div style={{ borderTop: '1px solid #333', paddingTop: 8, marginTop: 50 }}>
                ลงชื่อ ............................................
              </div>
              <div style={{ marginTop: 4 }}>( .......................................... )</div>
              <div style={{ color: '#555', marginTop: 4 }}>ผู้อำนวยการ</div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#999' }}>
            พิมพ์เมื่อ {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      )}

      {/* ══ DELETE ══ */}
      {renderPopup(showDeletePopup, false, <>
        <h3 style={popH3}>ยืนยันการลบรายงาน</h3>
        <p style={{ color: '#666', marginBottom: 16 }}>การลบไม่สามารถย้อนกลับได้</p>
        {selectedRecord && (
          <div style={{ background: '#fff3e0', padding: 15, borderRadius: 8, borderLeft: '4px solid #FF9800', marginBottom: 20, fontSize: 15 }}>
            <div><strong>วันที่:</strong> {convertDateToThai(selectedRecord.reportDate)}</div>
            <div><strong>ผู้ปฏิบัติหน้าที่:</strong> {selectedRecord.staffName}</div>
            <div><strong>กิจกรรม:</strong> {selectedRecord.activity}</div>
          </div>
        )}
        <label style={labelStyle}>รหัสผ่าน</label>
        <input type="password" className="input-field" value={password} autoFocus
          placeholder="ใส่รหัสผ่านเพื่อยืนยันการลบ"
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && executeDelete()} />
        {popupActions(
          () => { setShowDeletePopup(false); setSelectedRecord(null); setPassword(''); },
          executeDelete, 'ยืนยันการลบ', true
        )}
      </>)}
    </div>
  );
}

/* ─── style helpers ─── */
const labelStyle    = { display: 'block', marginBottom: 8, fontWeight: 600, color: '#1976D2', fontSize: 16 };
const h2Style       = { color: '#1976D2', marginBottom: 25, fontSize: 26, fontWeight: 700 };
const countStyle    = { textAlign: 'center', padding: 15, background: '#E3F2FD', borderRadius: 10, marginBottom: 20, fontSize: 18, fontWeight: 600, color: '#1976D2' };
const popH3         = { color: '#1976D2', marginBottom: 20, fontSize: 22, fontWeight: 700 };
const uploadZoneStyle = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  border: '2px dashed #BBDEFB', borderRadius: 8, padding: 20, textAlign: 'center',
  cursor: 'pointer', transition: 'all 0.3s ease', minHeight: 120, background: '#FAFAFA',
};
const btnStyle = (bg) => ({
  padding: '8px 20px', background: bg, color: 'white', border: 'none',
  borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  transition: 'all 0.3s ease', fontFamily: 'Sarabun, sans-serif',
});
const popBtnStyle = (bg, color) => ({
  flex: 1, padding: 12, background: bg, color, border: 'none',
  borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'Sarabun, sans-serif', transition: 'all 0.3s ease',
});
const tdStyle = { border: '1px solid #ddd', padding: '5px 6px', verticalAlign: 'top', fontSize: 11, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' };
const printBtnStyle = {
  width: '100%', padding: '14px 20px',
  background: 'linear-gradient(135deg, #43A047 0%, #2E7D32 100%)',
  color: 'white', border: 'none', borderRadius: 10,
  fontSize: 17, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'Sarabun, sans-serif', boxShadow: '0 2px 8px rgba(67,160,71,0.3)',
};

const NoData = () => (
  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#666' }}>
    <div style={{ fontSize: 64, marginBottom: 20, opacity: 0.5 }}>📋</div>
    <p style={{ fontSize: 20, fontWeight: 500 }}>ไม่พบรายงาน</p>
  </div>
);

export default App;
