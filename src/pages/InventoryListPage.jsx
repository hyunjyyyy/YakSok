import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';

// --- 아이콘 컴포넌트들 ---
const FilterIcon = () => <svg className="h-5 w-5 mr-2 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.572a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" /></svg>;
const SortIcon = () => <svg className="h-4 w-4 inline-block ml-1 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" /></svg>;

// --- 목(Mock) 데이터 ---
// 실제 앱에서는 이 데이터를 API로부터 받아옵니다.
const mockInventoryData = [
    { id: 'A-VAC-001', name: 'A 백신', category: '백신류', stock: 10, expiry: '2026-11-04', depletion: 5, status: '부족' },
    { id: 'C-ANT-015', name: 'B 항생제', category: '항생제류', stock: 25, expiry: '2025-10-15', depletion: 30, status: '임박' },
    { id: 'B-SWB-003', name: '이지클린 알코올 스왑', category: '소모품', stock: 853, expiry: '2027-09-01', depletion: 17, status: '정상' },
    { id: 'D-DRS-007', name: '멸균 거즈', category: '소모품', stock: 250, expiry: '2026-08-20', depletion: 25, status: '정상' },
    { id: 'E-PAI-002', name: '타이레놀 500mg', category: '일반의약품', stock: 120, expiry: '2025-12-01', depletion: 15, status: '정상' },
    { id: 'F-SYR-011', name: '일회용 주사기 10ml', category: '소모품', stock: 5, expiry: '2028-01-01', depletion: 1, status: '부족' },
];

// --- 상태 태그 컴포넌트 ---
const StatusTag = ({ status }) => {
    const statusMap = {
        '부족': { text: '재고 부족', style: 'bg-red-100 text-red-800' },
        '임박': { text: '기한 임박', style: 'bg-yellow-100 text-yellow-800' },
        '정상': { text: '정상', style: 'bg-green-100 text-green-800' },
    };
    const { text, style } = statusMap[status] || { text: '알 수 없음', style: 'bg-gray-100 text-gray-800' };
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${style}`}>{text}</span>;
};


const InventoryListPage = () => {
    // 필터와 정렬을 위한 상태 관리
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'ascending' });

    // 필터링 및 정렬 로직
    const filteredAndSortedData = useMemo(() => {
        let sortedData = [...mockInventoryData];

        // 필터링
        sortedData = sortedData.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.id.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
            const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
            return matchesSearch && matchesStatus && matchesCategory;
        });

        // 정렬
        sortedData.sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (a[sortConfig.key] > b[sortConfig.key]) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });

        return sortedData;
    }, [searchTerm, statusFilter, categoryFilter, sortConfig]);
    
    // 정렬 요청 핸들러
    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    return (
        <main className="bg-slate-50 p-4 sm:p-6 md:p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">전체 재고 현황</h2>

            {/* 필터 및 검색 영역 */}
            <div className="bg-white p-4 rounded-xl shadow mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                         <label htmlFor="search" className="block text-sm font-medium text-gray-700">검색</label>
                         <input
                            type="text"
                            id="search"
                            placeholder="품목명 또는 코드로 검색..."
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            onChange={(e) => setSearchTerm(e.target.value)}
                         />
                    </div>
                    <div>
                        <label htmlFor="status" className="block text-sm font-medium text-gray-700">상태</label>
                        <select id="status" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="all">전체</option>
                            <option value="부족">재고 부족</option>
                            <option value="임박">기한 임박</option>
                            <option value="정상">정상</option>
                        </select>
                    </div>
                     <div>
                        <label htmlFor="category" className="block text-sm font-medium text-gray-700">분류</label>
                        <select id="category" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" onChange={(e) => setCategoryFilter(e.target.value)}>
                            <option value="all">전체</option>
                            <option value="백신류">백신류</option>
                            <option value="항생제류">항생제류</option>
                            <option value="소모품">소모품</option>
                             <option value="일반의약품">일반의약품</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* 재고 리스트 테이블 */}
            <div className="bg-white rounded-xl shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('status')}>상태 <SortIcon /></th>
                                <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('name')}>품목명 / 코드 <SortIcon /></th>
                                <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('category')}>분류 <SortIcon /></th>
                                <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('stock')}>남은 재고 <SortIcon /></th>
                                <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('expiry')}>유통기한 <SortIcon /></th>
                                <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('depletion')}>예상 소진일 <SortIcon /></th>
                                <th scope="col" className="px-6 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAndSortedData.map(item => (
                                <tr key={item.id} className="border-t hover:bg-gray-50">
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
                {/* 페이지네이션은 여기에 추가할 수 있습니다. */}
            </div>
        </main>
    );
};

export default InventoryListPage;