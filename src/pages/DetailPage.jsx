import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import axios from 'axios';

/** 상대 경로 우선 (/api 프록시 사용). 필요 시 VITE_API_URL_BASE로 절대 경로 전환 */
const API_BASE = import.meta.env.VITE_API_URL_BASE || '';
const detailsUrl = (id) =>
  API_BASE ? `${API_BASE}/api/items/${id}/details`
           : `/api/items/${id}/details`;

/** 서버 응답 → UI 데이터 정규화 */
const normalizeDetail = (d) => {
  if (!d) return null;
  return {
    id: d.item_id,
    name: d.item_name,
    category: d.category,
    currentStock: Number(d.current_stock ?? d.current_stock_ea ?? 0),
    predictedNextMonth: Number(d.next_month_predicted_demand ?? 0),
    nearestExpiry: d.nearest_expiry_date ?? '-',
    // [{month: 'YYYY-MM', usage: number}]
    trend5y: Array.isArray(d.usage_trend_5y) ? d.usage_trend_5y : [],
    pattern1y: Array.isArray(d.monthly_usage_pattern_1y) ? d.monthly_usage_pattern_1y : [],
  };
};

/** 간단 바차트 바(가로막대) */
const Bar = ({ value, max, label, subLabel }) => {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0; // 최소 2%
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

/** 섹션 카드 */
const Card = ({ title, right, children, accent = 'border-emerald-500' }) => (
  <section className={`bg-white rounded-xl shadow-md p-6 border-l-4 ${accent}`}>
    <div className="flex items-center justify-between mb-4">
      <h3 className="font-bold text-lg text-gray-800">{title}</h3>
      {right}
    </div>
    {children}
  </section>
);

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
        }
      : null
  );
  const [loading, setLoading] = useState(!fromList);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(detailsUrl(itemId));
        const normalized = normalizeDetail(data);
        if (!normalized) throw new Error('상세 데이터가 없습니다.');
        if (mounted) setItem(normalized);
      } catch (e) {
        console.error('[details fetch]', e);
        // 목록에서 받은 데이터가 있으면 화면은 유지
        if (!fromList && mounted) setError(e?.message || '상세 데이터를 불러오지 못했습니다.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [itemId]);

  // 사용량 시리즈 최대값(바 너비 계산용)
  const max5y = useMemo(
    () => Math.max(0, ...((item?.trend5y || []).map((x) => Number(x.usage) || 0))),
    [item]
  );
  const max1y = useMemo(
    () => Math.max(0, ...((item?.pattern1y || []).map((x) => Number(x.usage) || 0))),
    [item]
  );

  if (!item && loading) return <main className="p-8">불러오는 중...</main>;
  if (!item && error) return <main className="p-8 text-red-600">{error}</main>;
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
      </div>

      {/* 핵심 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card
          title="✅ 핵심 지표"
          right={
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
              실시간 조회
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
              <span className="font-bold">{item.nearestExpiry || '-'}</span>
            </li>
          </ul>
        </Card>

        <Card title="💡 인사이트 (자동 요약)" accent="border-indigo-500">
          <ul className="list-disc pl-5 text-sm text-gray-700 space-y-2">
            <li>
              {item.predictedNextMonth != null
                ? `현재 재고 대비 다음 달 수요 ${item.predictedNextMonth.toLocaleString()} EA 고려 `
                : '현재 재고 및 사용 패턴 고려 '}
              {item.predictedNextMonth != null && item.currentStock < item.predictedNextMonth
                ? '→ 추가 발주 필요 가능성'
                : '→ 당분간 재고 여유 있음'}
            </li>
            {item.nearestExpiry && <li>가장 임박한 유통기한: <b>{item.nearestExpiry}</b></li>}
            {item.pattern1y?.length > 0 && <li>최근 1년 월별 사용 패턴을 기반으로 비수기/성수기 차이를 반영해 발주량을 조정하세요.</li>}
          </ul>
        </Card>
      </div>

      {/* 사용량 추이 5년 */}
      <Card title="📈 최근 5년 사용량 추이 (월별)">
        {item.trend5y?.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              {item.trend5y.map((row) => (
                <Bar
                  key={row.month}
                  value={Number(row.usage) || 0}
                  max={max5y}
                  label={row.month}
                />
              ))}
            </div>
            <div className="text-sm text-gray-600">
              <p className="mb-2">설명</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>월별 출고/폐기량 합계(절대값 기준)</li>
                <li>최근 5년 데이터 기반으로 이상 피크 및 저점을 파악</li>
              </ul>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">데이터가 없습니다.</p>
        )}
      </Card>

      {/* 월별 패턴 1년 */}
      <Card title="📊 최근 1년 월별 사용 패턴">
        {item.pattern1y?.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              {item.pattern1y.map((row) => (
                <Bar
                  key={row.month}
                  value={Number(row.usage) || 0}
                  max={max1y}
                  label={row.month}
                />
              ))}
            </div>
            <div className="text-sm text-gray-600">
              <p className="mb-2">설명</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>최근 12개월 사용량</li>
                <li>다음 달 발주량 산정 시 계절성 반영</li>
              </ul>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">데이터가 없습니다.</p>
        )}
      </Card>
    </main>
  );
};

export default DetailPage;
