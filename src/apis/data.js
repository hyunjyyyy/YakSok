import axios from 'axios';


const BASE =
  import.meta.env.VITE_API_URL_BASE || 'https://fcc0b7ff67e7.ngrok-free.app';

// 재고 리스트 조회
export const getInventoryData = async (apiUrl) => {
  try {
    const final = apiUrl || `${BASE}/api/inventory/status`;
    const { data } = await axios.get(final, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    return data;
  } catch (error) {
    console.error(`API Error fetching from ${apiUrl}:`, error);
    throw error;
  }
};


// 단일 품목 상세 조회
export const getInventoryItem = async (itemId) => {
  try {
    const { data } = await axios.get(`${BASE}/api/items/${itemId}`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    return data;
  } catch {
    // fallback: 목록에서 찾아서 반환
    const list = await getInventoryData();
    const arr = Array.isArray(list) ? list : list?.items || [];
    return arr.find(
      (d) =>
        d.item_id === itemId ||
        d.id === itemId ||
        d.code === itemId
    );
  }
};

// 재고 입고 (MainDashboard용)
export const stockIn = async (payload) => {
  try {
    // payload: { item_id, in_box_qty, expiry_date }
    const { data } = await axios.post(`${BASE}/api/inventory/in`, payload, { headers });
    return data;
  } catch (error) {
    console.error("API Error stocking in:", error);
    throw error;
  }
};

// 재고 출고 (MainDashboard용)
export const stockOut = async (payload) => {
  try {
    // payload: { item_id, out_ea_qty }
    const { data } = await axios.post(`${BASE}/api/inventory/out`, payload, { headers });
    return data;
  } catch (error) {
    console.error("API Error stocking out:", error);
    throw error;
  }
};

// 긴급 알림 상세리스트 (MainDashboard용)
export const getAlertsData = async () => {
  try {
    const { data } = await axios.get(`${BASE}/api/inventory/alerts`, { headers });
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
