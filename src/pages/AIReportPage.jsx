import React, { useState, useEffect, useRef } from 'react'; 
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import axios from 'axios';


// Chart.js에 필요한 구성 요소들을 등록합니다.
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// API BASE 정의
const NGROK_FALLBACK_URL = 'https://fcc0b7ff67e7.ngrok-free.app';
const API_BASE = import.meta.env.VITE_API_URL_BASE || NGROK_FALLBACK_URL;
const API_BASE_CLEAN = API_BASE.replace(/\/$/, '');
const NGROK_HEADER = { 'ngrok-skip-browser-warning': 'true' };

// API 엔드포인트 정의
const endpoints = {
    summary: () => `${API_BASE_CLEAN}/api/reports/summary-json`,
    detail: () => `${API_BASE_CLEAN}/api/reports/detailed-monthly`,
    graph: () => `${API_BASE_CLEAN}/api/reports/monthly-io-summary`,
};

// --- 아이콘 컴포넌트들 ---
const RobotIcon = () => <span className="text-2xl mr-2">🤖</span>;
const ChartIcon = () => <span className="text-2xl mr-2">📊</span>;
const DownloadIcon = () => <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>;


// --- 근거 데이터 섹션의 차트 컴포넌트 (API 데이터 사용) ---
const UsageChart = ({ graphData }) => {
    
    if (!graphData || graphData.length === 0) {
        return <div style={{ height: '350px' }} className="flex items-center justify-center text-gray-500">그래프 데이터가 없습니다.</div>;
    }

    // 서버 응답 데이터를 Chart.js 형식으로 변환
    const labels = graphData.map(d => new Date(d.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }));
    
    const totalOutbound = graphData.map(d => d.outbound + d.disposal);
    const inbound = graphData.map(d => d.inbound);
    
    const data = {
        labels,
        datasets: [
            { label: '총 출고/폐기량 (EA)', data: totalOutbound, borderColor: 'rgb(59, 130, 246)', backgroundColor: 'rgba(59, 130, 246, 0.5)', tension: 0.3},
            { label: '입고량 (EA)', data: inbound, borderColor: 'rgb(234, 179, 8)', backgroundColor: 'rgba(234, 179, 8, 0.5)', tension: 0.3},
        ],
    };

    const options = { 
        responsive: true, 
        plugins: { 
            legend: { position: 'top' }, 
            title: { display: false } 
        },
        scales: {
            y: {
                beginAtZero: true,
                title: { display: true, text: '수량 (EA)' }
            },
            x: {
                title: { display: true, text: '날짜' }
            }
        }
    };
    return <Line options={options} data={data} />;
};


const AIReportPage = () => {
    const [isDetailVisible, setIsDetailVisible] = useState(false);
    const [reportData, setReportData] = useState({
        summary: null,
        detail: null,
        graph: null,
        loading: true,
        error: null,
    });

    // API 호출 로직
    useEffect(() => {
        const fetchReportData = async () => {
            try {
                const [summaryRes, detailRes, graphRes] = await Promise.all([
                    axios.get(endpoints.summary(), { headers: NGROK_HEADER }),
                    axios.get(endpoints.detail(), { headers: NGROK_HEADER }),
                    axios.get(endpoints.graph(), { headers: NGROK_HEADER }),
                ]);

                const graphData = graphRes.data?.data || graphRes.data || []; 
                
                setReportData({
                    summary: summaryRes.data || {},
                    detail: detailRes.data || {},
                    graph: Array.isArray(graphData) ? graphData : [],
                    loading: false,
                    error: null,
                });
            } catch (e) {
                console.error("AI Report API fetch error:", e);
                setReportData(prev => ({
                    ...prev,
                    loading: false,
                    error: "리포트 데이터를 불러오는 데 실패했습니다."
                }));
            }
        };
        fetchReportData();
    }, []);
    
    // 로딩 처리
    if (reportData.loading) {
        return <main className="bg-slate-50 p-8 text-center text-gray-600">AI 리포트를 불러오는 중입니다...</main>;
    }
    if (reportData.error) {
        return <main className="bg-slate-50 p-8 text-center text-red-600 font-bold">오류: {reportData.error}</main>;
    }

    // 데이터 변수 준비
    const summary = reportData.summary || {};
    const detailText = reportData.detail?.report_text || "리포트 상세 분석 텍스트가 없습니다.";
    
    return (
        <main className="bg-slate-50 p-4 sm:p-6 md:p-8 space-y-8">
            
            <div>
              {/* 1. Yak-Sok 리포트 요약 (API 데이터 사용) */}
              <section className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
                  <h2 className="text-xl font-extrabold text-gray-800">Yak-Sok AI 리포트 (2025년 2월)</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-center">
                      <div className="bg-slate-100 p-3 rounded-lg">
                          <p className="text-sm font-bold text-gray-500">총 사용량</p>
                          <p className="text-lg font-bold text-gray-800">{summary.total_usage_last_month ? summary.total_usage_last_month.toLocaleString() : 'N/A'} EA</p>
                      </div>
                      <div className="bg-slate-100 p-3 rounded-lg">
                          <p className="text-sm font-bold text-gray-500">유통기한 임박</p>
                          <p className="text-lg font-bold text-yellow-600">{summary.nearing_expiry_item_count || 0} 개</p>
                      </div>
                      <div className="bg-slate-100 p-3 rounded-lg">
                          <p className="text-sm font-bold text-gray-500">재고 부족 위험</p>
                          <p className="text-lg font-bold text-red-600">{summary.low_stock_item_count || 0} 개</p>
                      </div>
                      <div 
                        style={{ 
                          background: 'linear-gradient(to right, rgb(59, 130, 246), rgb(79, 70, 229))' 
                        }} 
                        className="p-3 rounded-lg text-white"
                      >
                          <p className="text-sm font-bold opacity-80">재고 건전성 점수</p>
                          <p className="text-lg font-bold">{summary.inventory_health_score ? summary.inventory_health_score.toFixed(1) : 'N/A'} / 100</p>
                      </div>
                  </div>
              </section>

              {/* 2. AI 분석 및 근거 데이터 (통합 섹션) */}
              <section className="bg-white rounded-xl shadow-md p-6 space-y-6 mt-8">
                  {/* 2-1. AI 분석 및 권장 조치 */}
                  <div className="border-b pb-4">
                      <h3 className="flex items-center text-lg font-bold text-gray-800"><RobotIcon /> AI 분석 및 권장 조치</h3>
                      {/* 리포트 텍스트 (report_text) 출력 */}
                      <div className="mt-4 text-gray-700 space-y-3 whitespace-pre-wrap">
                          {detailText}
                      </div>
                  </div>
                  

                  {/* 2-2. 근거 데이터 */}
                  <div>
                      <div className="flex justify-between items-center border-b pb-4">
                          <h3 className="flex items-center text-lg font-bold text-gray-800"><ChartIcon /> 근거 데이터</h3>
                          <button onClick={() => setIsDetailVisible(!isDetailVisible)} className="text-sm font-bold text-blue-600 hover:underline">
                              {isDetailVisible ? '상세 데이터 닫기' : '상세 데이터 열기'}
                          </button>
                      </div>

                      {isDetailVisible && (
                          <div className="mt-6 space-y-8">
                              <div>
                                  <h4 className="font-bold text-md mb-2">총 입/출고 및 폐기 추세</h4>
                                  <div style={{ height: '350px' }}>
                                      {/* 그래프 데이터 전달 */}
                                      <UsageChart graphData={reportData.graph} />
                                  </div>
                              </div>
                              {/* 품목별 회전율 테이블은 목업 데이터로 유지 */}
                              <div>
                                  <h4 className="font-bold text-md mb-2">품목별 회전율 / 폐기율</h4>
                                  <div className="overflow-x-auto">
                                      <table className="w-full text-sm text-left">
                                          <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                              <tr><th className="px-6 py-3">품목명</th><th className="px-6 py-3">재고 회전율</th><th className="px-6 py-3">폐기율</th></tr>
                                          </thead>
                                          <tbody>
                                              <tr className="border-t"><td className="px-6 py-4 font-bold">주사기</td><td className="px-6 py-4">4.5회/년</td><td className="px-6 py-4 text-red-600 font-bold">5.2%</td></tr>
                                              <tr className="border-t"><td className="px-6 py-4 font-bold">거즈</td><td className="px-6 py-4">8.2회/년</td><td className="px-6 py-4">1.1%</td></tr>
                                          </tbody>
                                      </table>
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>
              </section>
            </div>
            
            {/* 3. 버튼 (최하단 배치) */}
            <div className="flex space-x-4">
                <button 
                    disabled={true} // PDF 기능 제거로 인해 버튼 비활성화
                    className="flex-1 flex items-center justify-center bg-blue-600 text-white font-bold py-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
                >
                    <DownloadIcon /> PDF 다운로드
                </button>
                <button className="flex-1 flex items-center justify-center bg-green-600 text-white font-bold py-2.5 rounded-lg hover:bg-green-700 transition-colors">
                    <DownloadIcon /> 출력하기
                </button>
            </div>
        </main>
    );
};

export default AIReportPage;