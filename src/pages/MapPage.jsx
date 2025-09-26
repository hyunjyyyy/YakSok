import React from 'react';
import MapContainer from '../components/map/MapContainer';

const MapPage = () => {
  const pageStyle = {
    width: '100vw',  // 화면 너비의 100%
    height: '100vh', // 화면 높이의 100%
  };

  return (
    <div style={pageStyle}>
      <MapContainer />
    </div>
  );
};

export default MapPage;