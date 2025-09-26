import React, { useState } from 'react';
import { Link } from 'react-router-dom'; // react-router-dom 설치 필요


// --- 상단 대시보드 카드들  ---
const SummaryCards = () => (
  <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
    <div className="bg-white rounded-xl shadow p-6 flex flex-col">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-600">유통기한 임박</h3>
      </div>
      <p className="text-3xl font-extrabold mt-4">
        5 <span className="text-lg font-semibold text-gray-500">품목</span>
      </p>
      <p className="text-sm text-gray-500 mt-2">D-7 이내 품목 있음</p>
    </div>

    <div className="bg-white rounded-xl shadow p-6 flex flex-col">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-600">부족 재고</h3>
      </div>
      <p className="text-3xl font-extrabold mt-4">
        3 <span className="text-lg font-semibold text-gray-500">품목</span>
      </p>
      <p className="text-sm text-gray-500 mt-2">예상 소진일 3일 남음</p>
    </div>

    <div className="bg-white rounded-xl shadow p-6 md:col-span-2 flex flex-col">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-600">AI 리포트</h3>
      </div>
      <p className="text-xl font-bold text-gray-800 mt-4 flex-grow">
        다음달 A백신 발주 권장량 <span className="text-red-500">20% 감소</span>
      </p>
      <Link
        to="/ai-report"
        className="text-sm text-gray-500 mt-2 hover:text-blue-600 hover:underline transition-colors"
     >
        월간 리포트에서 자세히 보기 &rarr;
      </Link>
    </div>
  </section>
);

// --- 실시간 재고 입력 ---
const RealtimeInput = () => {
  const [inputType, setInputType] = useState('in'); // 'in' or 'out'
  return (
    <section className="bg-white rounded-xl shadow p-6">
      <h3 className="font-bold text-lg mb-4">실시간 재고 기록</h3>
      <div className="flex border border-gray-300 rounded-lg p-1 bg-gray-100 w-min mb-4">
        <button
          onClick={() => setInputType('in')}
          className={`px-6 py-2 text-sm font-bold rounded-md ${inputType === 'in' ? 'bg-white shadow' : 'text-gray-600'}`}
        >
          입고
        </button>
        <button
          onClick={() => setInputType('out')}
          className={`px-6 py-2 text-sm font-bold rounded-md ${inputType === 'out' ? 'bg-white shadow' : 'text-gray-600'}`}
        >
          출고
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4 items-end">
        <div className="col-span-1">
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
            분류
          </label>
          <select id="category" className="w-full border border-gray-300 rounded-md shadow-sm">
            <option>백신류</option>
            <option>소모품</option>
            <option>항생제류</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="item_name" className="block text-sm font-medium text-gray-700 mb-1">
            품목명
          </label>
          <input
            type="text"
            id="item_name"
            className="w-full border border-gray-300 rounded-md shadow-sm"
          />
        </div>

        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
            수량({inputType === 'in' ? '박스' : 'EA'})
          </label>
          <input type="number" id="quantity" className="w-full border border-gray-300 rounded-md shadow-sm" placeholder="10" />
        </div>

        {inputType === 'in' ? (
          <>
            <div>
              <label htmlFor="ea_per_box" className="block text-sm font-medium text-gray-700 mb-1">
                박스당 EA
              </label>
              <input type="number" id="ea_per_box" className="w-full border border-gray-300 rounded-md shadow-sm" placeholder="50" />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="expiry_date" className="block text-sm font-medium text-gray-700 mb-1">
                유통기한
              </label>
              <input type="date" id="expiry_date" className="w-full border border-gray-300 rounded-md shadow-sm" />
            </div>
            <div className="md:col-span-3">
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                메모
              </label>
              <input type="text" id="notes" className="w-full border border-gray-300 rounded-md shadow-sm" placeholder="특이사항 입력 (선택)" />
            </div>
            <div className="md:col-span-1">
              <button className="w-full bg-slate-800 text-white font-bold py-2.5 rounded-lg hover:bg-slate-900 transition-colors">
                기록
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="md:col-span-2">
              <button className="w-full bg-slate-800 text-white font-bold py-2.5 rounded-lg hover:bg-slate-900 transition-colors">
                기록
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

// --- 긴급 알림 섹션 ---
const AlertList = () => {
  const alerts = [
    { id: 'A-VAC-001', name: 'A 백신', status: '부족', stock: '10 EA', depletion: '5일 후', expiry: '2026-11-04' },
    { id: 'C-ANT-015', name: 'B 항생제', status: '임박', stock: '25 EA', depletion: '30일 후', expiry: '2025-10-15' },
  ];

  return (
    <section className="bg-white rounded-xl shadow overflow-hidden">
      <div className="p-6">
        <h3 className="font-bold text-lg">긴급 알림</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50">
            <tr>
              <th className="px-6 py-3">품목명</th>
              <th className="px-6 py-3">남은 재고</th>
              <th className="px-6 py-3">예상 소진일</th>
              <th className="px-6 py-3">유통기한</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((item) => (
              <tr key={item.id} className="border-t hover:bg-gray-50">
                <td className="px-6 py-4 font-bold text-gray-900">
                  <span
                    className={`inline-flex items-center px-2 py-1 mr-2 rounded-full text-xs font-bold ${
                      item.status === '부족' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {item.status === '부족' ? '재고 부족' : '기한 임박'}
                  </span>
                  {item.name}
                </td>
                <td className="px-6 py-4">{item.stock}</td>
                <td className={`px-6 py-4 font-bold ${item.status === '부족' ? 'text-red-600' : ''}`}>{item.depletion}</td>
                <td className={`px-6 py-4 font-bold ${item.status === '임박' ? 'text-yellow-600' : ''}`}>{item.expiry}</td>
                <td className="px-6 py-4 text-right">
                  <Link to={`/detail/${item.id}`} className="font-bold text-blue-600 hover:underline">
                    자세히 보기
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

// --- 최종 메인 대시보드 페이지 ---
const MainDashboard = () => {
  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-7xl mx-auto">
        <main className="bg-slate-50 p-4 sm:p-6 md:p-8 space-y-8">
          <SummaryCards />
          <RealtimeInput />
          <AlertList />
        </main>
      </div>
    </div>
  );
};

export default MainDashboard;
