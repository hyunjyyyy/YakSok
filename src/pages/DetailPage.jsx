import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

/** API_BASE 정의 */
const NGROK_FALLBACK_URL = 'https://b07590104546.ngrok-free.app';
const API_BASE = import.meta.env.VITE_API_URL_BASE || NGROK_FALLBACK_URL;
const API_BASE_CLEAN = API_BASE.replace(/\/$/, ''); 

const API_PREFIX = '/api/items/';
const NGROK_HEADER = { 'ngrok-skip-browser-warning': 'true' };

const endpoints = {
  details: (id) => `${API_BASE_CLEAN}${API_PREFIX}${id}/details`,
  usage1y: (id) => `${API_BASE_CLEAN}${API_PREFIX}${id}/usage/1y`,
  usage5y: (id) => `${API_BASE_CLEAN}${API_PREFIX}${id}/usage/5y`,
};

// --- 재고 상태 문자열을 UI 스타일 객체로 매핑하는 함수 ---
const mapInventoryStatusToStyle = (rawStatus) => {
  const map = {
    '위험': { label: '❌ 위험', style: 'bg-red-100 text-red-800' },
    '경고': { label: '⚠️ 경고', style: 'bg-yellow-100 text-yellow-800' },
    '충분': { label: '✅ 충분', style: 'bg-green-100 text-green-800' },
    '조회 중': { label: '조회 중', style: 'bg-gray-200 text-gray-700' }, 
    '상태 오류': { label: '상태 오류', style: 'bg-red-100 text-red-700' }, 
  };
  // rawStatus가 null이거나 정의되지 않은 경우 '조회 중'으로 폴백 처리
  return map[rawStatus] || map['조회 중'];
};

/** 서버 응답 → UI 데이터 정규화 */
const normalizeDetail = (d, urlItemId, usage1y, usage5y) => {
  if (!d) return null;
    
  const currentStock = Number(d.current_stock ?? 0);
  const predictedNextMonth = Number(d.next_month_predicted_demand ?? 0);
    
  // 🚨 수정 반영: d.status 필드를 사용하여 재고 상태를 가져옴
  const apiStatus = d.status || '조회 중'; 
  const inventoryStatus = mapInventoryStatusToStyle(apiStatus);
    
  return {
    id: d.item_id || urlItemId, 
    name: d.item_name || '이름 없음', 
    category: d.category || '카테고리 없음',
    
    currentStock: currentStock,
    predictedNextMonth: predictedNextMonth,
    nearestExpiry: d.nearest_expiry_date ?? '-',
    
    inventoryStatus: inventoryStatus, 
    
    pattern1y: Array.isArray(usage1y.monthly_usage_pattern_1y) ? usage1y.monthly_usage_pattern_1y : [],
    trend5y: Array.isArray(usage5y.usage_trend_5y) ? usage5y.usage_trend_5y : [],
  };
};

// --- Line/Bar Chart 통합 Component ---
const ChartComponent = ({ title, data, dataKey, xKey, barName, isYearly }) => {
    
    if (!data || data.length === 0) {
        return (
            <Card title={title} accent="border-slate-400">
                <p className="text-sm text-gray-500">데이터가 없습니다.</p>
            </Card>
        );
    }
    
    const xAxisFormatter = (label) => {
        if (!label || typeof label !== 'string') return '';
        return isYearly ? label : `${label.split('-').pop()}월`;
    };
    
    const yAxisFormatter = (value) => `${value.toLocaleString()} EA`;
    const tooltipLabelFormatter = (label) => isYearly ? `${label}년` : `${label.split('-').pop()}월`;

    const ChartType = isYearly ? BarChart : LineChart;
    const VisualizationElement = isYearly ? Bar : Line;
    const strokeColor = isYearly ? '#2F6F59' : '#2F6F59';

    return (
        <Card title={title} accent="border-slate-400">
            <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ChartType
                        data={data}
                        margin={{ top: 30, right: 30, left: 10, bottom: 5 }} 
                        barCategoryGap={isYearly ? '20%' : undefined} 
                        barGap={isYearly ? 4 : undefined} 
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                        <XAxis 
                            dataKey={xKey} 
                            tick={{ fontSize: 12 }}
                            tickFormatter={xAxisFormatter}
                            interval={'preserveStartEnd'} 
                        />
                        <YAxis 
                            tickFormatter={yAxisFormatter} 
                            tick={{ fontSize: 12 }} 
                        />
                        <Tooltip 
                            cursor={isYearly ? { fill: '#f3f4f6' } : { strokeDasharray: '3 3' }}
                            formatter={(value) => [`${value.toLocaleString()} EA`, barName]}
                            labelFormatter={tooltipLabelFormatter}
                        />
                        <Legend wrapperStyle={{ paddingTop: '10px' }}/>
                        <VisualizationElement 
                            type={isYearly ? undefined : 'monotone'}
                            dataKey={dataKey} 
                            fill={isYearly ? strokeColor : undefined}
                            stroke={strokeColor} 
                            activeDot={{ r: 8 }} 
                            name={barName} 
                            strokeWidth={2} 
                            maxBarSize={isYearly ? 50 : undefined} 
                        />
                    </ChartType>
                </ResponsiveContainer>
            </div>
        </Card>
    );
};

// --- 유틸리티 컴포넌트 ---
const BarVisualization = ({ value, max, label, subLabel }) => {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span className="font-mono">{value.toLocaleString()} EA</span>
      </div>
      <div className="w-full bg-gray-100 h-2 rounded">
        <div
          className="h-2 rounded bg-emerald-500"
          style={{ width: `${width}%` }}
          title={subLabel || ''}
        />
      </div>
    </div>
  );
};

const Card = ({ title, right, children, accent = 'border-emerald-500' }) => (
  <section className={`bg-white rounded-xl shadow-md p-6 border-l-4 ${accent}`}>
    <div className="flex items-center justify-between mb-4">
      <h3 className="font-bold text-lg text-gray-800">{title}</h3>
      {right}
    </div>
    {children}
  </section>
);


// ----------------------------------------------------------------------------------
// --- DetailPage Component ---
// ----------------------------------------------------------------------------------
const DetailPage = () => {
  const { itemId } = useParams();
  const location = useLocation();
  const fromList = location.state?.item || null;

  const [item, setItem] = useState(
    fromList
      ? {
          id: fromList.id,
          name: fromList.name,
          category: fromList.category,
          currentStock: Number(fromList.stock ?? 0),
          predictedNextMonth: null,
          nearestExpiry: fromList.expiry ?? '-',
          trend5y: [],
          pattern1y: [],
          inventoryStatus: mapInventoryStatusToStyle('조회 중'), 
        }
      : null
  );
  const [loading, setLoading] = useState(!fromList);
  const [error, setError] = useState(null);
  
  const expiryDateClass = useMemo(() => {
    if (!item?.nearestExpiry || item.nearestExpiry === '-') return 'font-bold text-gray-700';
    const expiryDate = new Date(item.nearestExpiry);
    const today = new Date();
    const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysLeft <= 30) {
      return 'font-bold text-red-600';
    }
    return 'font-bold text-gray-700';
  }, [item]);
  
  const max5y = useMemo(
    () => Math.max(0, ...((item?.trend5y || []).map((x) => Number(x.usage) || 0))),
    [item]
  );


  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [detailsRes, usage1yRes, usage5yRes] = await Promise.all([
          axios.get(endpoints.details(itemId), { headers: NGROK_HEADER }),
          axios.get(endpoints.usage1y(itemId), { headers: NGROK_HEADER }),
          axios.get(endpoints.usage5y(itemId), { headers: NGROK_HEADER }),
        ]);

        const normalized = normalizeDetail(
          detailsRes.data,
          itemId,
          usage1yRes.data,
          usage5yRes.data
        );
        
        if (!normalized || !normalized.id) { 
             throw new Error('API 응답에 유효한 품목 ID가 포함되어 있지 않습니다.');
        }
        if (mounted) setItem(normalized);
      } catch (e) {
        console.error('[details fetch]', e);
        if (mounted) {
            if (!fromList) {
                setError(e?.message || '상세 데이터를 불러오지 못했습니다.');
            } else {
                // API 호출 실패 시 '상태 오류'로 변경
                setItem(prev => ({ 
                    ...prev, 
                    inventoryStatus: mapInventoryStatusToStyle('상태 오류') 
                }));
                setError('API 호출에 문제가 발생했으나, 기본 정보는 표시합니다.');
            }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [itemId]);


  if (!item && loading) return <main className="p-8">불러오는 중...</main>;
  if (!item && error) return <main className="p-8 text-red-600 font-bold">{error}</main>;
  if (!item) return <main className="p-8">데이터가 없습니다.</main>;

  return (
    <main className="bg-slate-50 p-4 sm:p-6 md:p-8 space-y-6">
      {/* 상단 헤더 */}
      <div>
        <Link
          to="/inventory"
          className="text-sm font-bold text-[#3A7D5E] hover:text-[#2F6F59] hover:underline flex items-center transition-colors"
        >
          <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          재고 리스트로
        </Link>
        <h2 className="text-2xl font-bold text-gray-800 mt-2">[{item.name}] 상세 리포트</h2>
        <p className="text-gray-500 text-sm mt-1">
          {item.id} · {item.category} {item.nearestExpiry && `· 최근접 유통기한: ${item.nearestExpiry}`}
        </p>
        {error && <p className="text-red-600 mt-2 text-sm font-bold">⚠️ {error}</p>}
      </div>

      {/* 핵심 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card
          title="✅ 핵심 지표"
          right={
            // item.inventoryStatus를 직접 사용
            <span className={`text-xs px-2 py-1 rounded-full ${item.inventoryStatus.style} font-bold`}>
              {item.inventoryStatus.label}
            </span>
          }
        >
          <ul className="space-y-3 text-gray-700">
            <li className="flex justify-between">
              <span>현재 재고</span>
              <span className="font-extrabold">{item.currentStock.toLocaleString()} EA</span>
            </li>
            {item.predictedNextMonth != null && (
              <li className="flex justify-between">
                <span>다음 달 예측 수요</span>
                <span className="font-extrabold">{item.predictedNextMonth.toLocaleString()} EA</span>
              </li>
            )}
            <li className="flex justify-between">
              <span>최근접 유통기한</span>
              <span className={expiryDateClass}>{item.nearestExpiry || '-'}</span>
            </li>
          </ul>
        </Card>

        <Card title="💡 인사이트 (자동 요약)" accent="border-slate-400">
          <ul className="list-disc pl-5 text-sm text-gray-700 space-y-2">
            <li>
              {item.predictedNextMonth != null
                ? `현재 재고 대비 다음 달 수요 ${item.predictedNextMonth.toLocaleString()} EA 고려 `
                : '현재 재고 및 사용 패턴 고려 '}
              {item.inventoryStatus.label === '❌ 위험' 
                ? '→ 추가 발주 필요 가능성'
                : '→ 당분간 재고 여유 있음'}
            </li>
            {item.nearestExpiry && <li>가장 임박한 유통기한: <b className={expiryDateClass}>{item.nearestExpiry}</b></li>}
            {item.pattern1y?.length > 0 && <li>최근 1년 월별 사용 패턴을 기반으로 비수기/성수기 차이를 반영해 발주량을 조정하세요.</li>}
          </ul>
        </Card>
      </div>
      
      {/* 3. 차트 섹션 */}
      <section className="space-y-6">
          {/* 5년 사용량 추이 (세로 막대 그래프) */}
          <ChartComponent 
              title="📈 최근 5년 사용 추이 (연도별)"
              data={item.trend5y}
              dataKey="usage"
              xKey="year" 
              barName="연간 사용량"
              isYearly={true}
          />

          {/* 1년 월별 사용 패턴 (꺾은선 그래프) */}
          <ChartComponent 
              title="📊 최근 1년 월별 사용 패턴"
              data={item.pattern1y}
              dataKey="usage"
              xKey="month" 
              barName="월별 사용량"
              isYearly={false}
          />
      </section>
    </main>
  );
};

export default DetailPage;