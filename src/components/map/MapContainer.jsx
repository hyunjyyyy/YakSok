import React, { useEffect, useState, useRef } from "react";

// 초기 데이터
const initialMockData = [
  {
    hospital_id: 101,
    hospital_name: "A병원",
    lat: 37.5443,
    lng: 126.967,
    near_expiry_items: [
      { item_name: "아빌리파이정 2mg", quantity: 15, expiry_date: "2025-10-28", isChecked: false },
      { item_name: "타이레놀 500mg", quantity: 50, expiry_date: "2025-11-20", isChecked: false },
      { item_name: "뮤코펙트정", quantity: 22, expiry_date: "2025-12-01", isChecked: false },
    ],
  },
  {
    hospital_id: 102,
    hospital_name: "B병원",
    lat: 37.5458,
    lng: 126.958,
    near_expiry_items: [
      { item_name: "리도카인 주사제", quantity: 40, expiry_date: "2025-11-05", isChecked: false },
      { item_name: "세포탁심 주사", quantity: 30, expiry_date: "2025-10-30", isChecked: false },
      { item_name: "5% 포도당 수액", quantity: 60, expiry_date: "2026-01-15", isChecked: false },
      { item_name: "아티반 주사 2mg", quantity: 18, expiry_date: "2025-11-18", isChecked: false },
    ],
  },
  {
    hospital_id: 103,
    hospital_name: "C병원",
    lat: 37.5429,
    lng: 126.961,
    near_expiry_items: [
      { item_name: "오구멘틴정 625mg", quantity: 25, expiry_date: "2025-10-22", isChecked: false },
      { item_name: "후시딘 연고", quantity: 45, expiry_date: "2025-12-25", isChecked: false },
      { item_name: "알마겔정", quantity: 70, expiry_date: "2025-11-08", isChecked: false },
    ],
  },
];

// 간단한 모달 컴포넌트
const Modal = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "20px 30px",
          borderRadius: "8px",
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
          textAlign: "center",
          maxWidth: "400px",
          lineHeight: "1.6",
        }}
      >
        <p style={{ marginBottom: "20px", fontSize: "16px" }}>{message}</p>
        <button
          onClick={onClose}
          style={{
            padding: "8px 16px",
            border: "none",
            borderRadius: "4px",
            backgroundColor: "#007bff",
            color: "white",
            cursor: "pointer",
          }}
        >
          닫기
        </button>
      </div>
    </div>
  );
};

const MapContainer = () => {
  const [hospitals, setHospitals] = useState(initialMockData);
  const [modalInfo, setModalInfo] = useState({
    isVisible: false,
    message: "",
  });

  const hospitalsRef = useRef(hospitals);

  useEffect(() => {
    hospitalsRef.current = hospitals;
  }, [hospitals]);

  useEffect(() => {
    if (window.kakao && window.kakao.maps) {
      initMap();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${import.meta.env.VITE_KAKAO_MAP_KEY}&autoload=false`;
    script.async = true;

    script.onload = () => {
      console.log("✅ Kakao Map SDK 로드 완료");
      setTimeout(() => initMap(), 0);
    };

    script.onerror = () => {
      console.error("❌ Kakao Map SDK 로드 실패!");
    };

    document.head.appendChild(script);

    function initMap() {
      window.kakao.maps.load(() => {
        const mapContainer = document.getElementById("map");
        const mapOption = {
          center: new window.kakao.maps.LatLng(37.545, 126.963),
          level: 4,
          draggable: true,
          scrollwheel: true,
        };
        const map = new window.kakao.maps.Map(mapContainer, mapOption);

        mapContainer.addEventListener('change', (event) => {
          const target = event.target;
          if (target.type === 'checkbox' && target.dataset.hospitalId) {
            const hospitalId = parseInt(target.dataset.hospitalId, 10);
            const itemIndex = parseInt(target.dataset.itemIndex, 10);
            const isChecked = target.checked;

            setHospitals(currentHospitals => {
              const newHospitals = JSON.parse(JSON.stringify(currentHospitals));
              const hospital = newHospitals.find(h => h.hospital_id === hospitalId);
              if (hospital && hospital.near_expiry_items[itemIndex]) {
                hospital.near_expiry_items[itemIndex].isChecked = isChecked;
              }
              return newHospitals;
            });
          }
        });

        mapContainer.addEventListener('click', (event) => {
          const target = event.target;
          if (target.tagName === 'BUTTON' && target.id.startsWith('contactBtn_')) {
            const hospitalId = parseInt(target.id.replace('contactBtn_', ''), 10);
            const hospital = hospitalsRef.current.find(h => h.hospital_id === hospitalId);

            if (hospital) {
              const checkedItems = hospital.near_expiry_items.filter(item => item.isChecked);

              if (checkedItems.length === 0) {
                setModalInfo({
                  isVisible: true,
                  message: "요청할 약품을 선택해주세요.",
                });
                return;
              }

              const itemsText = checkedItems
                .map(item => `${item.item_name} (${item.quantity}개)`)
                .join(', ');

              const finalMessage = `${hospital.hospital_name}에 ${itemsText} 요청 메시지를 보냈습니다!`;

              setModalInfo({
                isVisible: true,
                message: finalMessage,
              });
            }
          }
        });

        let openInfoWindow = null;

        hospitals.forEach((hospital) => {
          const marker = new window.kakao.maps.Marker({
            position: new window.kakao.maps.LatLng(hospital.lat, hospital.lng),
            map,
          });

          const infowindow = new window.kakao.maps.InfoWindow({
            content: generateInfoWindowContent(hospital), // 초기 컨텐츠 설정
            removable: true,
          });

          window.kakao.maps.event.addListener(marker, "click", () => {
            if (openInfoWindow) {
              openInfoWindow.close();
            }
            const currentHospitalData = hospitalsRef.current.find(h => h.hospital_id === hospital.hospital_id);
            infowindow.setContent(generateInfoWindowContent(currentHospitalData));
            infowindow.open(map, marker);
            openInfoWindow = infowindow;
          });
        });
      });
    }

    function generateInfoWindowContent(hospital) {
      if (!hospital) return '';
      let content = `
        <div style="padding:8px; font-size:13px; min-width:240px; line-height: 1.5;">
          <strong>${hospital.hospital_name}</strong>
          <ul style="margin: 8px 0; padding-left:0; list-style-type:none;">
      `;
      hospital.near_expiry_items.forEach((item, index) => {
        content += `
            <li style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <label for="item_${hospital.hospital_id}_${index}" style="cursor: pointer; text-align: left;">
                    ${item.item_name} (${item.quantity}개) <br/>
                    <small>유통기한: ${item.expiry_date}</small>
                </label>
                <input type="checkbox"
                       id="item_${hospital.hospital_id}_${index}"
                       data-hospital-id="${hospital.hospital_id}"
                       data-item-index="${index}"
                       ${item.isChecked ? 'checked' : ''}
                       style="margin-left: 8px; cursor: pointer;">
            </li>
        `;
      });
      content += `
          </ul>
          <div style="text-align: center;">
             <button id="contactBtn_${hospital.hospital_id}" style="padding: 5px 10px; border: 1px solid #ccc; background-color: #f0f0f0; cursor: pointer; border-radius: 4px;">선택 항목 요청하기</button>
          </div>
        </div>`;
      return content;
    }

    return () => {
      if (script && document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  return (
    <>
      <div
        id="map"
        style={{
          width: "75%",
          height: "80%",
          position: "relative",
          zIndex: 0,
        }}
      />
      <Modal
        message={modalInfo.message}
        onClose={() => setModalInfo({ isVisible: false, message: "" })}
      />
    </>
  );
};

export default MapContainer;