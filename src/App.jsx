import React, { useState, useEffect } from 'react';
import { Calendar, FileText, Settings, Plus, Edit, Trash2, CheckCircle, Clock, User, MapPin, Activity, AlertCircle, Printer, X } from 'lucide-react';

const API_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxHY8wqA9JSN7GJx5F31IpkYOIJn0bZEsg_bFrlWLvkTrX-diCI7DD7qOG1KfU4AQW2-A/exec?sheetId=1TLuQMZUvdXR-5CH_jTJ3GHMqXchmlkkAc7yg5ZLG2dU';
const SECRET_PASSWORD = '123456';
const DIRECTOR_PASSWORD = '789012';

function App() {
  const [activeTab, setActiveTab] = useState('daily');
  const [dataRecords, setDataRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAcknowledgePopup, setShowAcknowledgePopup] = useState(false);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [showEditPopup, setShowEditPopup] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [directorPassword, setDirectorPassword] = useState('');
  const [password, setPassword] = useState('');
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  // Form states
  const [formData, setFormData] = useState({
    reportDate: '',
    dutyTime: '',
    staffName: '',
    position: '',
    location: '',
    activity: '',
    eventDetail: '',
    note: '',
    imageFile: null
  });

  const [editFormData, setEditFormData] = useState({
    reportDate: '',
    dutyTime: '',
    staffName: '',
    position: '',
    location: '',
    activity: '',
    eventDetail: '',
    note: '',
    imageFile: null
  });

  useEffect(() => {
    loadAllData();
    setFormData(prev => ({ ...prev, reportDate: getCurrentDate() }));
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_ENDPOINT}&action=read`);
      const result = await response.json();
      if (result.success) {
        setDataRecords(result.data || []);
      }
    } catch (error) {
      showNotificationMessage('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotificationMessage = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: 'success' });
    }, 4000);
  };

  const getCurrentDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const convertDateToThai = (dateString) => {
    if (!dateString) return 'ไม่ระบุวันที่';
    
    let dateStr = String(dateString);
    if (dateStr.includes('T')) {
      dateStr = dateStr.split('T')[0];
    }
    
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);
    
    const date = new Date(Date.UTC(year, month - 1, day));
    const thaiYear = date.getUTCFullYear() + 543;
    const displayMonth = date.getUTCMonth() + 1;
    const displayDay = date.getUTCDate();
    
    return `${displayDay}/${displayMonth}/${thaiYear}`;
  };

  const handleAcknowledge = (record) => {
    setSelectedRecord(record);
    setShowAcknowledgePopup(true);
  };

  const executeAcknowledge = async () => {
    if (directorPassword !== DIRECTOR_PASSWORD) {
      showNotificationMessage('รหัสผ่านผู้อำนวยการไม่ถูกต้อง', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_ENDPOINT}&action=acknowledge&id=${encodeURIComponent(selectedRecord.id)}`);

      const result = await response.json();
      if (result.success) {
        showNotificationMessage('รับทราบรายงานสำเร็จ', 'success');
        setShowAcknowledgePopup(false);
        setDirectorPassword('');
        await loadAllData();
      } else {
        showNotificationMessage(result.message || 'เกิดข้อผิดพลาด', 'error');
      }
    } catch (error) {
      showNotificationMessage('เกิดข้อผิดพลาดในการรับทราบ', 'error');
    }
  };

  const buildReportCard = (record, showActions = false) => {
    const dateText = convertDateToThai(record.reportDate);
    const timeText = record.dutyTime || 'ไม่ระบุเวลา';
    
    return (
      <div key={record.id} className="bg-white rounded-lg shadow-md p-6 mb-4 border border-gray-200">
        <div className="flex justify-between items-start mb-4">
          <div className="text-gray-600">
            <div className="font-semibold">วันที่ {dateText} เวลา {timeText}</div>
          </div>
          <div className="flex items-center gap-2">
            {record.acknowledged && (
              <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                <CheckCircle size={16} />
                ผู้อำนวยการรับทราบแล้ว
              </div>
            )}
          </div>
        </div>
        
        <div className="space-y-3">
          <div><span className="font-medium text-gray-700">ผู้ปฏิบัติหน้าที่:</span> {record.staffName}</div>
          <div><span className="font-medium text-gray-700">ตำแหน่ง:</span> {record.position}</div>
          <div><span className="font-medium text-gray-700">สถานที่:</span> {record.location}</div>
          <div><span className="font-medium text-gray-700">กิจกรรมที่ปฏิบัติ:</span> {record.activity}</div>
          {record.eventDetail && (
            <div><span className="font-medium text-gray-700">เหตุการณ์และรายละเอียด:</span> {record.eventDetail}</div>
          )}
          {record.note && (
            <div><span className="font-medium text-gray-700">หมายเหตุ:</span> {record.note}</div>
          )}
        </div>

        {record.imageUrl && (
          <div className="mt-4">
            <img 
              src={record.imageUrl} 
              alt="รูปภาพประกอบรายงาน" 
              className="max-w-full h-48 object-cover rounded-lg border"
              onError={(e) => e.target.style.display = 'none'}
            />
          </div>
        )}

        {!showActions && !record.acknowledged && (
          <div className="mt-4">
            <button
              onClick={() => handleAcknowledge(record)}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <CheckCircle size={18} />
              รับทราบ
            </button>
          </div>
        )}

        {showActions && (
          <div className="mt-4 flex gap-2">
            <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
              <Edit size={18} />
              แก้ไข
            </button>
            <button className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
              <Trash2 size={18} />
              ลบ
            </button>
          </div>
        )}
      </div>
    );
  };

  const filteredData = dataRecords.filter(record => {
    if (activeTab === 'daily') {
      const selectedDate = formData.reportDate;
      if (!selectedDate || !record.reportDate) return false;
      
      let recordDateString = record.reportDate;
      if (typeof recordDateString === 'string') {
        recordDateString = recordDateString.split('T')[0];
      }
      
      return recordDateString === selectedDate;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-4">
      {/* Notification */}
      {notification.show && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
          notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h1 className="text-2xl font-bold text-blue-600 text-center mb-2">ระบบรายงานการปฏิบัติหน้าที่ดูแลนักเรียน</h1>
        <p className="text-center text-gray-600">โรงเรียนตัวอย่าง</p>
      </div>

      {/* Navigation */}
      <div className="bg-white rounded-lg shadow-md p-2 mb-6">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              activeTab === 'daily' 
                ? 'bg-blue-500 text-white' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Calendar size={18} className="inline mr-2" />
            รายงานประจำวัน
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              activeTab === 'all' 
                ? 'bg-blue-500 text-white' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FileText size={18} className="inline mr-2" />
            รายงานทั้งหมด
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              activeTab === 'admin' 
                ? 'bg-blue-500 text-white' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Settings size={18} className="inline mr-2" />
            จัดการข้อมูล
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow-md p-6">
        {activeTab === 'daily' && (
          <div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">เลือกวันที่</label>
              <input
                type="date"
                value={formData.reportDate}
                onChange={(e) => setFormData(prev => ({ ...prev, reportDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="text-sm text-gray-600 mb-4">
              จำนวนรายงานวันที่ {convertDateToThai(formData.reportDate)} มี {filteredData.length} รายการ
            </div>
          </div>
        )}

        {activeTab === 'all' && (
          <div className="text-sm text-gray-600 mb-4">
            จำนวนรายงานทั้งหมด {dataRecords.length} รายการ
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="text-sm text-gray-600 mb-4">
            จำนวนรายงานทั้งหมด {dataRecords.length} รายการ
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="mt-2 text-gray-600">กำลังโหลดข้อมูล...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-8">
            <FileText size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">ไม่พบรายงาน</p>
          </div>
        ) : (
          <div>
            {filteredData.map(record => buildReportCard(record, activeTab === 'admin'))}
          </div>
        )}
      </div>

      {/* Acknowledge Popup */}
      {showAcknowledgePopup && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">ยืนยันการรับทราบรายงาน</h3>
            <p className="text-gray-600 mb-4">
              กรุณาใส่รหัสผ่านของผู้อำนวยการเพื่อยืนยันการรับทราบรายงานนี้
            </p>
            
            <div className="bg-orange-50 p-4 rounded-lg mb-4 border-l-4 border-orange-500">
              <div className="text-sm">
                <div><strong>วันที่:</strong> {convertDateToThai(selectedRecord.reportDate)}</div>
                <div><strong>เวลา:</strong> {selectedRecord.dutyTime || 'ไม่ระบุเวลา'}</div>
                <div><strong>ผู้ปฏิบัติหน้าที่:</strong> {selectedRecord.staffName}</div>
                <div><strong>ตำแหน่ง:</strong> {selectedRecord.position}</div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">รหัสผ่านผู้อำนวยการ</label>
              <input
                type="password"
                value={directorPassword}
                onChange={(e) => setDirectorPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="กรุณาใส่รหัสผ่าน"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowAcknowledgePopup(false);
                  setDirectorPassword('');
                  setSelectedRecord(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={executeAcknowledge}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium"
              >
                ยืนยันการรับทราบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
