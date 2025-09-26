import axios from 'axios';


const BASE =
  import.meta.env.VITE_API_URL_BASE || 'https://b07590104546.ngrok-free.app';

// API 호출 시 사용할 공통 헤더
const headers = { 'ngrok-skip-browser-warning': 'true' };

// 재고 리스트 조회
export const getInventoryData = async (apiUrl) => {
  try {
    const final = apiUrl || `${BASE}/api/inventory/status`;
    const { data } = await axios.get(final, { headers }); // headers 적용
    return data;
  } catch (error) {
    console.error(`API Error fetching from ${apiUrl}:`, error);
    throw error;
  }
};


// 단일 품목 상세 리포트 조회
export const getDetailReport = async (itemId) => {
  try {
    const { data } = await axios.get(`${BASE}/api/items/${itemId}/report`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    return data;
  } catch (error) {
    console.error(`API Error fetching detail report for ${itemId}:`, error);
    throw error;
  }
};

// 재고 입고 (MainDashboard용)
// API: /api/inventory/in, payload: { item_id, in_box_qty, expiry_date }
export const stockIn = async (payload) => {
  try {
    const { data } = await axios.post(`${BASE}/api/inventory/in`, payload, { headers });
    return data;
  } catch (error) {
    console.error("API Error stocking in:", error);
    throw error;
  }
};

// 재고 출고 (MainDashboard용)
// API: /api/inventory/out, payload: { item_id, out_ea_qty }
export const stockOut = async (payload) => {
  try {
    const { data } = await axios.post(`${BASE}/api/inventory/out`, payload, { headers });
    return data;
  } catch (error) {
    console.error("API Error stocking out:", error);
    throw error;
  }
};

// 긴급 알림 상세리스트 (MainDashboard용)
// API: /api/alerts/details (경로 수정됨)
export const getAlertsData = async () => {
  try {
    const { data } = await axios.get(`${BASE}/api/alerts/details`, { headers });
    return data;
  } catch (error) {
    console.error("API Error fetching alerts data:", error);
    throw error;
  }
};

// 긴급 알림 요약정보 (MainDashboard 상단 카드용)
export const getAlertsSummary = async () => {
    try {
        const { data } = await axios.get(`${BASE}/api/alerts/summary`, { headers });
        return data;
    } catch (error) {
        console.error("API Error fetching alerts summary:", error);
        throw error;
    }
};