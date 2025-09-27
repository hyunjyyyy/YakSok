import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { stockIn, stockOut, getAlertsData, getAlertsSummary } from '../apis/data';
import { ITEM_LIST } from '../utils/itemList';
import expired from "../assets/expired.png";
import shortage from "../assets/shortage.png";
import ai from "../assets/ai_report.png";

// --- 상단 대시보드 카드들 (API 연동) ---
const SummaryCards = () => {
  const [summary, setSummary] = useState({
    lowStockCount: 0,
    expiryCount: 0,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const data = await getAlertsSummary();
        setSummary({
          lowStockCount: data.low_stock_item_count || 0,
          expiryCount: data.nearing_expiry_item_count || 0,
          loading: false,
          error: null,
        });
      } catch (err) {
        console.error("Error fetching alerts summary:", err);
        setSummary(prev => ({
          ...prev,
          loading: false,
          error: "요약 정보를 불러올 수 없습니다."
        }));
      }
    };
    fetchSummary();
  }, []);

  if (summary.loading) {
    return <section className="grid grid-cols-1 md:grid-cols-4 gap-6"><p className="md:col-span-4 text-center text-gray-500">요약 데이터 로딩 중...</p></section>;
  }

  return (
    <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {summary.error ? (
        <div className="bg-red-100 text-red-700 p-4 rounded-xl shadow md:col-span-4">{summary.error}</div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow p-6 flex flex-col">
            <div className="flex items-center gap-1">
              <img src={expired} alt="expired" className="w-6 h-6" />
              <h3 className="font-bold text-gray-600 -ml-1"> 유통기한 임박</h3>
            </div>
            <p className="text-3xl font-extrabold mt-4">
              5 <span className="text-lg font-semibold text-gray-500">품목</span>
            </p>
            <p className="text-sm text-gray-500 mt-2">D-7 이내 품목 있음</p>
          </div>

          <div className="bg-white rounded-xl shadow p-6 flex flex-col">
            <div className="flex items-center gap-1">
              <img src={shortage} alt="shortage" className="w-6 h-6" />
              <h3 className="font-bold text-gray-600">부족 재고</h3>
            </div>
            <p className="text-3xl font-extrabold mt-4">
              3 <span className="text-lg font-semibold text-gray-500">품목</span>
            </p>
            <p className="text-sm text-gray-500 mt-2">예상 소진일 3일 남음</p>
          </div>
        </>
      )}

      <div className="bg-white rounded-xl shadow p-6 md:col-span-2 flex flex-col">
        <div className="flex items-center gap-1">
          <img src={ai} alt="ai" className="w-6 h-6" />
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
};


// --- 실시간 재고 입력 ---
const RealtimeInput = () => {
  const [inputType, setInputType] = useState('in');
  const [formData, setFormData] = useState({
    itemId: '',
    itemName: '',
    quantity: '',
    expiryDate: '',
  });
  const [loading, setLoading] = useState(false);

  const selectedItem = useMemo(() => {
    return ITEM_LIST.find(item => item.item_name === formData.itemName);
  }, [formData.itemName]);

  const resetForm = () => {
    setFormData({
      itemId: '',
      itemName: '',
      quantity: '',
      expiryDate: '',
    });
  };

  const handleItemChange = (e) => {
    const name = e.target.value;
    const item = ITEM_LIST.find(i => i.item_name === name);
    setFormData(prev => ({
      ...prev,
      itemName: name,
      itemId: item ? item.item_id : '',
    }));
  };

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!formData.itemId || !formData.quantity) {
      alert('품목명과 수량을 입력해주세요.');
      return;
    }

    if (inputType === 'in' && !formData.expiryDate) {
      alert('입고 시에는 유통기한을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      if (inputType === 'in') {
        const payload = {
          item_id: formData.itemId,
          in_box_qty: parseInt(formData.quantity, 10),
          expiry_date: formData.expiryDate,
        };
        await stockIn(payload);
        alert(`[${payload.item_id}] ${payload.in_box_qty} 박스 입고 처리 완료.`);
      } else {
        const payload = {
          item_id: formData.itemId,
          out_ea_qty: parseInt(formData.quantity, 10),
        };
        await stockOut(payload);
        alert(`[${payload.item_id}] ${payload.out_ea_qty} EA 출고 처리 완료.`);
      }
      resetForm();
    } catch (error) {
      console.error('재고 기록 중 오류 발생:', error);
      alert('재고 기록에 실패했습니다. 콘솔을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-white rounded-xl shadow p-6">
      <h3 className="font-bold text-lg mb-4">실시간 재고 기록</h3>
      <div className="flex flex-nowrap border border-gray-300 rounded-lg p-0.5 bg-gray-100 w-max mb-4">
        <button
          onClick={() => { setInputType('in'); resetForm(); }}
          className={`px-6 py-2 text-sm font-bold rounded-md whitespace-nowrap ${inputType === 'in' ? 'bg-white shadow' : 'text-gray-600'}`}
        >
          입고
        </button>
        <button
          onClick={() => { setInputType('out'); resetForm(); }}
          className={`px-6 py-2 text-sm font-bold rounded-md whitespace-nowrap ${inputType === 'out' ? 'bg-white shadow' : 'text-gray-600'}`}
        >
          출고
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">

          {/* 품목명 (드롭다운) */}
          <div className="col-span-1">
            <label htmlFor="itemName" className="block text-sm font-medium text-gray-700 mb-1">
              품목명
            </label>
            <select
              id="itemName"
              value={formData.itemName}
              onChange={handleItemChange}
              className="w-full border border-gray-300 rounded-md shadow-sm p-2"
              required
            >
              <option value="" disabled>품목을 선택하세요</option>
              {ITEM_LIST.map((item) => (
                <option key={item.item_id} value={item.item_name}>
                  {item.item_name}
                </option>
              ))}
            </select>
          </div>

          {/* 수량 */}
          <div>
            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
              수량({inputType === 'in' ? '박스' : 'EA'})
            </label>
            <input
              type="number"
              id="quantity"
              value={formData.quantity}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-md shadow-sm p-2"
              placeholder={inputType === 'in' ? '10' : '50'}
              min="1"
              required
            />
          </div>

          {/* 유통기한 (입고 시에만) */}
          {inputType === 'in' ? (
            <div>
              <label htmlFor="expiryDate" className="block text-sm font-medium text-gray-700 mb-1">
                유통기한
              </label>
              <input
                type="date"
                id="expiryDate"
                value={formData.expiryDate}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                required
              />
            </div>
          ) : (
            /* 출고 시 버튼을 위해 공간을 남겨둡니다. */
            <div></div>
          )}
        </div>

        {/* 기록 버튼 */}
        <div className="flex justify-end mt-4">
          <button
            type="submit"
            className="w-full sm:w-1/3 md:w-1/4 text-white font-bold py-2.5 rounded-lg hover:bg-slate-900 transition-colors disabled:bg-gray-400"
            style={{ backgroundColor: '#2F6F59' }}
            disabled={loading || !formData.itemId}
          >
            {loading ? '처리 중...' : '기록'}
          </button>
        </div>

      </form>
    </section>
  );
};

// --- 긴급 알림 섹션 ---
const AlertList = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const data = await getAlertsData();

        const lowStock = data.low_stock_alert_details || [];
        const expiry = data.expiry_alert_details || [];

        const combinedAlerts = [
          // 재고 부족 알림: days_left 사용, 유통기한은 없으면 null 처리
          ...(lowStock.map(item => ({
            item_id: item.item_id,
            item_name: item.item_name,
            current_stock: Number(item.current_stock_ea || 0), // 값이 없으면 0으로 처리
            days_left: item.days_left != null ? parseFloat(item.days_left) : null, // 값이 없으면 null
            status: '부족',
            nearest_expiry_date: item.nearest_expiry_date || null, // 값이 없으면 null
            id: `low-${item.item_id}-${item.days_left}`,
          }))),
          // 기한 임박 알림: 유통기한 사용, days_left는 null 처리
          ...(expiry.map(item => ({
            item_id: item.item_id,
            item_name: item.item_name,
            current_stock: Number(item.batch_stock_ea || 0), // 값이 없으면 0으로 처리
            days_left: null, // 예상 소진일 정보 없음
            status: '임박',
            nearest_expiry_date: item.expiry_date || null, // 값이 없으면 null
            id: `exp-${item.item_id}-${item.expiry_date}`,
          }))),
        ];

        setAlerts(combinedAlerts);
      } catch (err) {
        setError('알림 데이터를 불러오는 데 실패했습니다.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, []);

  if (loading) return <p className="p-6 text-center text-gray-500">알림 데이터를 불러오는 중...</p>;
  if (error) return <p className="p-6 text-center text-red-500 font-bold">{error}</p>;
  if (alerts.length === 0) return <p className="p-6 text-center text-gray-500">현재 긴급 알림이 없습니다.</p>;


  return (
    <section className="bg-white rounded-xl shadow overflow-hidden">
      <div className="p-6">
        <h3 className="font-bold text-lg">긴급 알림 ({alerts.length}건)</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50">
            <tr>
              <th className="px-6 py-3">품목명</th>
              <th className="px-6 py-3">남은 재고 (EA)</th>
              <th className="px-6 py-3">예상 소진일 (D-Day)</th>
              <th className="px-6 py-3">유통기한</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((item) => (
              <tr key={item.id} className="border-t hover:bg-gray-50">
                <td className="px-6 py-4 font-bold text-gray-900">
                  <span
                    className={`inline-flex items-center px-2 py-1 mr-2 rounded-full text-xs font-bold ${item.status === '부족' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                      }`}
                  >
                    {item.status === '부족' ? '재고 부족' : '기한 임박'}
                  </span>
                  {item.item_name}
                </td>
                <td className="px-6 py-4">{item.current_stock.toLocaleString()} EA</td>
                <td className={`px-6 py-4 font-bold ${item.status === '부족' ? 'text-red-600' : ''}`}>
                  {/* days_left가 있으면 일수로 표시, 아니면 '-' */}
                  {item.days_left !== null ? `${Math.floor(item.days_left)}일 후 (${item.days_left.toFixed(1)})` : '-'}
                </td>
                <td className={`px-6 py-4 font-bold ${item.status === '임박' ? 'text-yellow-600' : ''}`}>
                  {item.nearest_expiry_date || '-'}
                </td>
                <td className="px-6 py-4 text-right">
                  <Link to={`/detail/${item.item_id}`} className="font-bold text-blue-600 hover:underline">
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