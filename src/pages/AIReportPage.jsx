import React, { useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

// Chart.js에 필요한 구성 요소들을 등록합니다.
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// --- 아이콘 컴포넌트들 ---
const HealthIcon = () => <span className="text-2xl mr-2">❤️‍🩹</span>;
const AlertIcon = () => <span className="text-2xl mr-2">🚨</span>;
const BoxIcon = () => <span className="text-2xl mr-2">📦</span>;
const RobotIcon = () => <span className="text-2xl mr-2">🤖</span>;
const ChartIcon = () => <span className="text-2xl mr-2">📊</span>;
const DownloadIcon = () => <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>;


// --- 근거 데이터 섹션의 차트 컴포넌트 (예시) ---
const UsageChart = () => {
  const options = { responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: '월별 사용량 vs 재고 추세' } } };
  const labels = ['9월', '10월', '11월', '12월', '1월', '2월'];
  const data = {
    labels,
    datasets: [
      { label: '총 사용량 (EA)', data: [11050, 11500, 13000, 14200, 13500, 12430], borderColor: 'rgb(59, 130, 246)', backgroundColor: 'rgba(59, 130, 246, 0.5)'},
      { label: '월말 재고량 (EA)', data: [25000, 22000, 18000, 15000, 16000, 17500], borderColor: 'rgb(234, 179, 8)', backgroundColor: 'rgba(234, 179, 8, 0.5)'},
    ],
  };
  return <Line options={options} data={data} />;
};


const AIReportPage = () => {
    const [isDetailVisible, setIsDetailVisible] = useState(false);

    return (
        <main className="bg-slate-50 p-4 sm:p-6 md:p-8 space-y-8">
            {/* 1. Yak-Sok 리포트 요약 (수정됨) */}
            <section className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
                <h2 className="text-xl font-extrabold text-gray-800">Yak-Sok AI 리포트 (2025년 2월)</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-center">
                    <div className="bg-slate-100 p-3 rounded-lg">
                        <p className="text-sm font-bold text-gray-500">총 사용량</p>
                        <p className="text-lg font-bold text-gray-800">12,430 EA</p>
                    </div>
                    <div className="bg-slate-100 p-3 rounded-lg">
                        <p className="text-sm font-bold text-gray-500">유통기한 임박</p>
                        <p className="text-lg font-bold text-yellow-600">12 개</p>
                    </div>
                    <div className="bg-slate-100 p-3 rounded-lg">
                        <p className="text-sm font-bold text-gray-500">재고 부족 위험</p>
                        <p className="text-lg font-bold text-red-600">8 개</p>
                    </div>
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-3 rounded-lg text-white">
                        <p className="text-sm font-bold opacity-80">재고 건전성 점수</p>
                        <p className="text-lg font-bold">85 / 100</p>
                    </div>
                </div>
            </section>

            {/* AI 분석 요약 */}
            <section className="bg-white rounded-xl shadow-md p-6">
                 <h3 className="flex items-center text-lg font-bold text-gray-800"><RobotIcon /> AI 분석 및 권장 조치</h3>
                 <div className="mt-4 text-gray-700 space-y-3">
                    <p>지난달 대비 전체 의약품 사용량은 <span className="font-bold text-blue-600">15% 증가</span>했으며, 특히 동절기 영향으로 '호흡기 관련 소모품' 카테고리의 소비가 두드러졌습니다.</p>
                    <p>AI 발주 추천 기능을 통해 '백신류'의 과잉 재고가 전월 대비 <span className="font-bold text-green-600">20% 감소</span>하여, 잠재적인 폐기 위험을 크게 줄였습니다.</p>
                    <p className="font-bold">종합 분석 결과, 다음 3가지 조치를 최우선으로 권장합니다:</p>
                    <ol className="list-decimal list-inside space-y-2 pl-2">
                        <li><span className="font-bold text-red-600">즉시 발주:</span> 수액세트(5박스), C 항생제(2박스)</li>
                        <li><span className="font-bold text-yellow-600">교환/소진 계획:</span> 유통기한 임박 '거즈'는 인근 B병원 수요와 교환 추진</li>
                        <li><span className="font-bold text-blue-600">재고 수준 검토:</span> '특수 소모품' 카테고리 전반의 안전 재고 수준 상향 조정 필요</li>
                    </ol>
                 </div>
                 <div className="mt-6 flex space-x-4">
                    <button className="flex-1 flex items-center justify-center bg-blue-600 text-white font-bold py-2.5 rounded-lg hover:bg-blue-700 transition-colors"><DownloadIcon /> PDF 다운로드</button>
                    <button className="flex-1 flex items-center justify-center bg-green-600 text-white font-bold py-2.5 rounded-lg hover:bg-green-700 transition-colors"><DownloadIcon /> 엑셀 내보내기</button>
                </div>
            </section>

            {/* 근거 데이터 */}
            <section className="bg-white rounded-xl shadow-md p-6">
                 <div className="flex justify-between items-center">
                    <h3 className="flex items-center text-lg font-bold text-gray-800"><ChartIcon /> 근거 데이터</h3>
                    <button onClick={() => setIsDetailVisible(!isDetailVisible)} className="text-sm font-bold text-blue-600 hover:underline">
                        {isDetailVisible ? '상세 데이터 닫기' : '상세 데이터 열기'}
                    </button>
                 </div>

                 {isDetailVisible && (
                    <div className="mt-6 space-y-8">
                        <div>
                            <h4 className="font-bold text-md mb-2">월별 사용량 vs 재고 추세</h4>
                            <UsageChart />
                        </div>
                        <div>
                            <h4 className="font-bold text-md mb-2">품목별 회전율 / 폐기율</h4>
                             <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                        <tr><th className="px-6 py-3">품목명</th><th className="px-6 py-3">재고 회전율</th><th className="px-6 py-3">폐기율</th></tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-t"><td className="px-6 py-4 font-bold">주사기</td><td className="px-6 py-4">4.5회/년</td><td className="px-6 py-4 text-red-500">5.2%</td></tr>
                                        <tr className="border-t"><td className="px-6 py-4 font-bold">거즈</td><td className="px-6 py-4">8.2회/년</td><td className="px-6 py-4">1.1%</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                 )}
            </section>
        </main>
    );
};

export default AIReportPage;