import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from './supabaseClient'
import { 
  Search, ShieldAlert, MapPin, Download, Plus, 
  ChevronDown, ChevronUp, Trophy, X, Activity, AlertCircle, ShieldCheck
} from 'lucide-react'
import './App.css'

function MapRecenter({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center) {
      map.flyTo(center, 6, { duration: 1.5 })
    }
  }, [center, map])
  return null
}

export default function App() {
  const [outbreaks, setOutbreaks] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false)
  const [showAdminModal, setShowAdminModal] = useState(false)

  const [formData, setFormData] = useState({
    disease_name: '',
    variant_name: '',
    symptoms: '',
    prevention: '',
    country: 'ประเทศไทย',
    province: '',
    district: '',
    latitude: '',
    longitude: '',
    status: 'Ongoing',
    infected_count: 0,
    death_count: 0
  })

  useEffect(() => {
    fetchOutbreaks()
  }, [])

  async function fetchOutbreaks() {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('outbreak_statistic')
        .select(`
          id,
          status,
          infected_count,
          death_count,
          recorded_at,
          diseases(id, name, description, symptoms, prevention),
          locations(id, country, province, district, latitude, longitude)
        `)

      if (error) {
        console.warn('Falling back to outbreak_cases table:', error.message)
        fetchFallbackOutbreaks()
        return
      }

      if (data) {
        const formatted = data.map(item => ({
          id: item.id,
          disease_name: item.diseases?.name || 'ไม่ระบุชื่อโรค',
          variant_name: '',
          description: item.diseases?.description || '',
          symptoms: item.diseases?.symptoms || 'ไม่ระบุอาการ',
          prevention: item.diseases?.prevention || 'ไม่ระบุวิธีป้องกัน',
          country: item.locations?.country || '',
          province: item.locations?.province || '',
          district: item.locations?.district || '',
          latitude: parseFloat(item.locations?.latitude) || 13.7563,
          longitude: parseFloat(item.locations?.longitude) || 100.5018,
          status: item.status || 'Ongoing',
          infected_count: item.infected_count || 0,
          death_count: item.death_count || 0,
          recorded_at: item.recorded_at
        }))
        setOutbreaks(formatted)
      }
    } catch (err) {
      console.error('Error fetching Supabase data:', err.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchFallbackOutbreaks() {
    try {
      const { data, error } = await supabase
        .from('outbreak_cases')
        .select(`
          id, status, infected_count, death_count,
          diseases(name, description, symptoms, prevention),
          locations(country, province, district, latitude, longitude)
        `)
      if (data) {
        const formatted = data.map(item => ({
          id: item.id,
          disease_name: item.diseases?.name || 'ไม่ระบุชื่อโรค',
          variant_name: '',
          symptoms: item.diseases?.symptoms || '-',
          prevention: item.diseases?.prevention || '-',
          country: item.locations?.country || '',
          province: item.locations?.province || '',
          district: item.locations?.district || '',
          latitude: parseFloat(item.locations?.latitude) || 13.7563,
          longitude: parseFloat(item.locations?.longitude) || 100.5018,
          status: item.status || 'Ongoing',
          infected_count: item.infected_count || 0,
          death_count: item.death_count || 0
        }))
        setOutbreaks(formatted)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const filteredOutbreaks = outbreaks.filter(item => {
    const matchesSearch = 
      item.disease_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.province && item.province.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.district && item.district.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const top5Outbreaks = [...filteredOutbreaks]
    .sort((a, b) => b.infected_count - a.infected_count)
    .slice(0, 5)

  const exportToCSV = () => {
    if (filteredOutbreaks.length === 0) return alert('ไม่มีข้อมูลสำหรับ Export')

    const headers = ["Disease", "Variant", "Country", "Province", "District", "Status", "Infected", "Deaths", "Symptoms", "Prevention"]
    const rows = filteredOutbreaks.map(o => [
      `"${o.disease_name}"`,
      `"${o.variant_name}"`,
      `"${o.country}"`,
      `"${o.province}"`,
      `"${o.district}"`,
      `"${o.status}"`,
      o.infected_count,
      o.death_count,
      `"${o.symptoms}"`,
      `"${o.prevention}"`
    ])

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `รายงานระบาดวิทยา_${new Date().toISOString().slice(0,10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }


  const handleInsertData = async (e) => {
    e.preventDefault()
    try {
      const { data: diseaseRes, error: disErr } = await supabase
        .from('diseases')
        .insert([{ 
          name: formData.disease_name,
          symptoms: formData.symptoms,
          prevention: formData.prevention
        }])
        .select()
      if (disErr) throw disErr

      const { data: locRes, error: locErr } = await supabase
        .from('locations')
        .insert([{
          country: formData.country,
          province: formData.province,
          district: formData.district,
          latitude: parseFloat(formData.latitude),
          longitude: parseFloat(formData.longitude)
        }])
        .select()
      if (locErr) throw locErr

      const { error: statErr } = await supabase
        .from('outbreak_statistic')
        .insert([{
          disease_id: diseaseRes[0].id,
          location_id: locRes[0].id,
          status: formData.status,
          infected_count: parseInt(formData.infected_count),
          death_count: parseInt(formData.death_count)
        }])
      
      if (statErr) {
        await supabase.from('outbreak_cases').insert([{
          disease_id: diseaseRes[0].id,
          location_id: locRes[0].id,
          status: formData.status,
          infected_count: parseInt(formData.infected_count),
          death_count: parseInt(formData.death_count)
        }])
      }

      alert('บันทึกข้อมูลลงฐานข้อมูลเรียบร้อย!')
      setShowAdminModal(false)
      fetchOutbreaks()
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message)
    }
  }

  const createCustomIcon = (status) => {
    const bg = status === 'Ongoing' ? '#ff2a5f' : '#00f0ff'
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="background-color: ${bg}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px ${bg};"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    })
  }

  return (
    <div className="dashboard-container">
      <header className="top-nav">
        <div className="brand-title">
          <ShieldAlert color="#00f0ff" size={24} />
          ระบบติดตามการระบาดทั่วโลก
        </div>

        <div className="controls-group">
          <div className="search-box">
            <Search className="icon" size={16} />
            <input
              type="text"
              placeholder="ค้นหาชื่อโรค, จังหวัด, หรืออำเภอ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select 
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">สถานะทั้งหมด</option>
            <option value="Ongoing">กำลังระบาด (Ongoing)</option>
            <option value="Past">สิ้นสุดการระบาด (Past)</option>
          </select>

          <button className="btn-fui" onClick={exportToCSV}>
            <Download size={14} /> ส่งออก CSV
          </button>

          <button className="btn-fui btn-fui-red" onClick={() => setShowAdminModal(true)}>
            <Plus size={14} /> เพิ่มข้อมูล
          </button>
        </div>
      </header>
      <div className="main-view">
        <div className="map-wrapper">
          <MapContainer
            center={[13.7563, 100.5018]}
            zoom={5}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              className="dark-tile-layer"
              url="https://mt1.google.com/vt/lyrs=m&hl=th&x={x}&y={y}&z={z}"
              attribution='&copy; <a href="https://www.google.com/maps">Google Maps</a>'
            />

            {selectedLocation && <MapRecenter center={selectedLocation} />}

            {filteredOutbreaks.map((item) => (
              <Marker
                key={item.id}
                position={[item.latitude, item.longitude]}
                icon={createCustomIcon(item.status)}
              >
                <Popup>
                  <div style={{ color: '#fff', padding: '6px', maxWidth: '240px' }}>
                    <h3 style={{ margin: '0 0 4px 0', color: '#00f0ff' }}>
                      {item.disease_name} {item.variant_name && `(${item.variant_name})`}
                    </h3>
                    <p style={{ margin: '2px 0', fontSize: '0.85rem' }}>
                      <MapPin size={12} color="#ffb700" /> {item.district ? `${item.district}, ` : ''}{item.province ? `${item.province}, ` : ''}{item.country}
                    </p>
                    <hr style={{ borderColor: 'rgba(0,240,255,0.2)', margin: '6px 0' }} />
                    <p style={{ margin: '2px 0', fontSize: '0.8rem' }}>
                      สถานะ: <span style={{ color: item.status === 'Ongoing' ? '#ff2a5f' : '#00f0ff' }}>{item.status === 'Ongoing' ? 'กำลังระบาด' : 'สิ้นสุดแล้ว'}</span>
                    </p>
                    <p style={{ margin: '2px 0', fontSize: '0.8rem' }}>ผู้ติดเชื้อ: {item.infected_count?.toLocaleString()} คน</p>
                    <p style={{ margin: '2px 0', fontSize: '0.8rem' }}>ผู้เสียชีวิต: {item.death_count?.toLocaleString()} คน</p>
                    
                    {item.symptoms && (
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#a0c4df' }}>
                        <strong>อาการ:</strong> {item.symptoms}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
      <div className={`bottom-panel ${isPanelCollapsed ? 'collapsed' : ''}`}>
        <button 
          className="panel-toggle-btn"
          onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
        >
          {isPanelCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />} 
          {isPanelCollapsed ? 'ขยายแผงข้อมูล' : 'ย่อแผงข้อมูล'}
        </button>

        <div className="insights-box">
          <div className="section-title">
            <span><Trophy size={14} color="#ffb700" /> 5 อันดับพื้นที่ระบาดสูงสุด</span>
          </div>
          <div className="leaderboard-list">
            {top5Outbreaks.map((item, index) => (
              <div key={item.id} className="leaderboard-item">
                <span>#{index + 1} {item.disease_name} ({item.province || item.country})</span>
                <span style={{ color: '#ffb700', fontWeight: 'bold' }}>
                  {item.infected_count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="feed-box">
          <div className="section-title">
            <span>ข้อมูลโรคระบาดตามพื้นที่ (อาการ & วิธีป้องกันจาก SQL)</span>
          </div>
          <div className="detail-cards-grid">
            {loading ? (
              <div style={{ color: '#5c83a6' }}>กำลังโหลดข้อมูล SQL...</div>
            ) : filteredOutbreaks.length === 0 ? (
              <div style={{ color: '#5c83a6' }}>ไม่พบข้อมูลโรคที่ค้นหา</div>
            ) : (
              filteredOutbreaks.map((item) => (
                <div
                  key={item.id}
                  className="info-card"
                  onClick={() => setSelectedLocation([item.latitude, item.longitude])}
                >
                  <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.9rem' }}>
                    {item.disease_name} {item.variant_name && `<${item.variant_name}>`}
                  </div>
                  <div style={{ color: '#5c83a6', fontSize: '0.8rem', margin: '2px 0' }}>
                    <MapPin size={11} /> {item.district ? `${item.district}, ` : ''}{item.province ? `${item.province}, ` : ''}{item.country}
                  </div>
                  
                  <div style={{ fontSize: '0.75rem', color: '#a0c4df', marginTop: '4px' }}>
                    <div><AlertCircle size={10} color="#ffb700" /> อาการ: {item.symptoms}</div>
                    <div><ShieldCheck size={10} color="#00ff88" /> ป้องกัน: {item.prevention}</div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '6px' }}>
                    <span style={{ color: '#ffb700' }}>ติดเชื้อ: {item.infected_count.toLocaleString()}</span>
                    <span style={{ color: '#ff2a5f' }}>เสียชีวิต: {item.death_count.toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showAdminModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ width: '500px' }}>
            <div className="modal-header">
              <span>บันทึกข้อมูลการระบาดของโรค</span>
              <X size={18} style={{ cursor: 'pointer' }} onClick={() => setShowAdminModal(false)} />
            </div>
            <form onSubmit={handleInsertData}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label>ชื่อโรคระบาด</label>
                  <input 
                    type="text" required 
                    value={formData.disease_name} 
                    onChange={e => setFormData({...formData, disease_name: e.target.value})}
                    placeholder="เช่น ไข้เลือดออก" 
                  />
                </div>
                <div className="form-group">
                  <label>สายพันธุ์ (Variant)</label>
                  <input 
                    type="text" 
                    value={formData.variant_name} 
                    onChange={e => setFormData({...formData, variant_name: e.target.value})}
                    placeholder="เช่น DENV-2 (ถ้ามี)" 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>อาการของโรค (Symptoms)</label>
                <input 
                  type="text" 
                  value={formData.symptoms} 
                  onChange={e => setFormData({...formData, symptoms: e.target.value})}
                  placeholder="เช่น ไข้สูง ปวดศีรษะ ผื่นแดง" 
                />
              </div>

              <div className="form-group">
                <label>วิธีป้องกัน (Prevention)</label>
                <input 
                  type="text" 
                  value={formData.prevention} 
                  onChange={e => setFormData({...formData, prevention: e.target.value})}
                  placeholder="เช่น ทำลายแหล่งเพาะพันธุ์ยุงลาย" 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <div className="form-group">
                  <label>ประเทศ</label>
                  <input 
                    type="text" required 
                    value={formData.country} 
                    onChange={e => setFormData({...formData, country: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>จังหวัด</label>
                  <input 
                    type="text" required
                    value={formData.province} 
                    onChange={e => setFormData({...formData, province: e.target.value})}
                    placeholder="เช่น เชียงใหม่"
                  />
                </div>
                <div className="form-group">
                  <label>อำเภอ / เขต</label>
                  <input 
                    type="text" 
                    value={formData.district} 
                    onChange={e => setFormData({...formData, district: e.target.value})}
                    placeholder="เช่น เมือง"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label>Latitude (พิกัดละติจูด)</label>
                  <input 
                    type="number" step="any" required 
                    value={formData.latitude} 
                    onChange={e => setFormData({...formData, latitude: e.target.value})}
                    placeholder="เช่น 18.7883" 
                  />
                </div>
                <div className="form-group">
                  <label>Longitude (พิกัดลองจิจูด)</label>
                  <input 
                    type="number" step="any" required 
                    value={formData.longitude} 
                    onChange={e => setFormData({...formData, longitude: e.target.value})}
                    placeholder="เช่น 98.9853" 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label>สถานะ</label>
                  <select 
                    value={formData.status} 
                    onChange={e => setFormData({...formData, status: e.target.value})}
                  >
                    <option value="Ongoing">Ongoing (กำลังระบาด)</option>
                    <option value="Past">Past (สิ้นสุดแล้ว)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>ผู้ติดเชื้อ</label>
                  <input 
                    type="number" 
                    value={formData.infected_count} 
                    onChange={e => setFormData({...formData, infected_count: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>ผู้เสียชีวิต</label>
                  <input 
                    type="number" 
                    value={formData.death_count} 
                    onChange={e => setFormData({...formData, death_count: e.target.value})}
                  />
                </div>
              </div>

              <button type="submit" className="btn-fui btn-fui-red" style={{ width: '100%', marginTop: '8px', justifyContent: 'center' }}>
                บันทึกข้อมูลลงฐานข้อมูล
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}