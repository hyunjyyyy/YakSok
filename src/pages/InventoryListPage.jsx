import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getInventoryData } from '../apis/data';

const API_URL = import.meta.env.VITE_API_URL || 'https://b07590104546.ngrok-free.app/api/inventory/status';

const SortIcon = () => (
  <svg className="h-4 w-4 inline-block ml-1 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
  </svg>
);

/** 서버 상태값 → UI 상태값 매핑  */
const mapStatus = (raw) => {
  // 서버가 '충분/부족/임박' 같이 보낼 때 UI 표기 규칙으로 변환
  if (raw === '충분') return '충분';
  if (raw === '경고') return '경고';
  if (raw === '위험') return '위험';
  return '정상';
};

const StatusTag = ({ status }) => {
  const map = {
    위험: { text: '위험', style: 'bg-red-100 text-red-800' },
    경고: { text: '경고', style: 'bg-yellow-100 text-yellow-800' },
    충분: { text: '충분', style: 'bg-green-100 text-green-800' },
  };
  const { text, style } = map[status] || { text: '알 수 없음', style: 'bg-gray-100 text-gray-800' };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${style}`}>{text}</span>;
};

/** 응답 → UI 데이터 정규화 (서버 스키마 대응: item_name, item_id, current_stock_ea, days_left, adu, category, status) */
const normalizeItems = (raw) => {
  const arr = Array.isArray(raw) ? raw : raw?.items || [];
  return arr.map((d, idx) => {
    const id = d.item_id ?? d.id ?? d.code ?? `ITEM-${idx}`;
    const name = d.item_name ?? d.name ?? '이름없음';
    const categoryRaw = d.category ?? d.group ?? '기타';
    // 카테고리 표준화 (필요 시 확장)
    const category = categoryRaw === '의료 소모품' ? '소모품' : categoryRaw;

    const stock = Number(d.current_stock_ea ?? d.stock ?? d.qty ?? d.quantity ?? 0);
    const adu = d.adu != null ? Number(d.adu) : null; // 일평균 사용량
    const daysLeft = d.days_left != null ? Math.round(Number(d.days_left)) : null;

    // UI 컬럼과 호환
    return {
      id,
      name,
      category,
      stock,
      // 서버에 유통기한이 없으므로 일단 '-' 처리 (추후 스키마 추가 시 교체)
      expiry: d.expiry ?? d.expireDate ?? '-',
      depletion: daysLeft ?? 0, // "예상 소진일까지 남은 일수"
      adu,                      // 필요 시 테이블/툴팁 등에 노출 가능
      status: mapStatus(d.status ?? d.state),
    };
  });
};

const InventoryListPage = () => {
  const [inventoryData, setInventoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  // 필터/정렬
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'ascending' });

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const data = await getInventoryData(API_URL);
        const items = normalizeItems(data);
        if (mounted) setInventoryData(items);
      } catch (e) {
        console.error('[Inventory fetch error]', e);
        if (mounted) setError(e?.message || '데이터를 불러오는 데 실패했습니다.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const filteredAndSortedData = useMemo(() => {
    let arr = [...inventoryData];

    // 필터
    arr = arr.filter((item) => {
      const name = (item.name ?? '').toString().toLowerCase();
      const idStr = (item.id ?? '').toString().toLowerCase();
      const s = (searchTerm ?? '').toLowerCase();

      const matchesSearch = name.includes(s) || idStr.includes(s);
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });

    // 정렬 (문자/숫자 혼합 안전 처리)
    arr.sort((a, b) => {
      const { key, direction } = sortConfig;
      const avRaw = a[key];
      const bvRaw = b[key];

      const avNum = Number(avRaw);
      const bvNum = Number(bvRaw);
      const bothNumeric = !Number.isNaN(avNum) && !Number.isNaN(bvNum);

      let cmp = 0;
      if (bothNumeric) {
        cmp = avNum - bvNum;
      } else {
        const av = (avRaw ?? '').toString();
        const bv = (bvRaw ?? '').toString();
        if (av < bv) cmp = -1;
        else if (av > bv) cmp = 1;
        else cmp = 0;
      }

      return direction === 'ascending' ? cmp : -cmp;
    });

    return arr;
  }, [inventoryData, searchTerm, statusFilter, categoryFilter, sortConfig]);

  const requestSort = (key) =>
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending',
    }));

  if (loading) return <main className="p-8">불러오는 중...</main>;
  if (error) return <main className="p-8 text-red-600">{error}</main>;

  return (
    <main className="bg-slate-50 p-4 sm:p-6 md:p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">전체 재고 현황</h2>

      {/* 필터 & 검색 */}
      <div className="bg-white p-4 rounded-xl shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700">검색</label>
            <input
              id="search"
              placeholder="  품목명 또는 코드로 검색..."
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700">상태</label>
            <select
              id="status"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm"
              onChange={(e) => setStatusFilter(e.target.value)}
              defaultValue="all"
            >
              <option value="all">전체</option>
              <option value="부족">재고 부족</option>
              <option value="임박">기한 임박</option>
              <option value="정상">정상</option>
            </select>
          </div>
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700">분류</label>
            <select
              id="category"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm"
              onChange={(e) => setCategoryFilter(e.target.value)}
              defaultValue="all"
            >
              <option value="all">전체</option>
              {/* 서버에서 '의료 소모품'으로 내려오면 정규화에서 '소모품'으로 변환됨 */}
              <option value="백신류">백신류</option>
              <option value="항생제류">항생제류</option>
              <option value="소모품">소모품</option>
              <option value="일반의약품">일반의약품</option>
            </select>
          </div>
        </div>
      </div>

      {/* 리스트 테이블 */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th className="px-6 py-3 cursor-pointer" onClick={() => requestSort('status')}>상태 <SortIcon /></th>
                <th className="px-6 py-3 cursor-pointer" onClick={() => requestSort('name')}>품목명 / 코드 <SortIcon /></th>
                <th className="px-6 py-3 cursor-pointer" onClick={() => requestSort('category')}>분류 <SortIcon /></th>
                <th className="px-6 py-3 cursor-pointer" onClick={() => requestSort('stock')}>남은 재고 <SortIcon /></th>
                <th className="px-6 py-3 cursor-pointer" onClick={() => requestSort('expiry')}>유통기한 <SortIcon /></th>
                <th className="px-6 py-3 cursor-pointer" onClick={() => requestSort('depletion')}>예상 소진일 <SortIcon /></th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedData.map((item, i) => (
                <tr key={`${item.id}-${i}`} className="border-t hover:bg-gray-50">
                  <td className="px-6 py-4"><StatusTag status={item.status} /></td>
                  <td className="px-6 py-4 font-bold text-gray-900">
                    {item.name}
                    <p className="font-normal text-gray-500 text-xs">{item.id}</p>
                  </td>
                  <td className="px-6 py-4">{item.category}</td>
                  <td className="px-6 py-4">{item.stock} EA</td>
                  <td className={`px-6 py-4 font-bold ${item.status === '임박' ? 'text-yellow-600' : ''}`}>{item.expiry}</td>
                  <td className={`px-6 py-4 font-bold ${item.status === '부족' ? 'text-red-600' : ''}`}>{item.depletion}일 후</td>
                  <td className="px-6 py-4 text-right">
                    <Link to={`/detail/${item.id}`} className="font-bold text-blue-600 hover:underline">자세히</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* TODO: 페이지네이션 */}
      </div>
    </main>
  );
};

export default InventoryListPage;
